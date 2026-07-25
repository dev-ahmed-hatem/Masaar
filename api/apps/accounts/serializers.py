from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.markets.models import Market

from . import errors, services
from .models import PhoneOTP, StudentProfile, User
from .utils import normalize_phone


def tokens_for_user(user: User) -> dict:
    """Issue an access/refresh pair carrying role + name claims."""
    refresh = RefreshToken.for_user(user)
    access = refresh.access_token
    for token in (refresh, access):
        token["role"] = user.role
        token["full_name"] = user.full_name
    return {"refresh": str(refresh), "access": str(access)}


class UserSerializer(serializers.ModelSerializer):
    market = serializers.SlugRelatedField(slug_field="code", read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "phone",
            "full_name",
            "email",
            "role",
            "locale",
            "market",
            "is_verified",
            "must_change_password",
        )
        read_only_fields = fields


class SignupSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    full_name = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=8, style={"input_type": "password"})
    market = serializers.SlugRelatedField(slug_field="code", queryset=Market.objects.all())
    locale = serializers.ChoiceField(choices=User.Locale.choices, default=User.Locale.AR)

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        attrs["phone"] = normalize_phone(attrs["phone"], attrs["market"].code)
        if User.objects.filter(phone=attrs["phone"]).exists():
            raise errors.PhoneAlreadyRegistered()
        return attrs

    def create(self, validated):
        user = User.objects.create_user(
            phone=validated["phone"],
            password=validated["password"],
            full_name=validated["full_name"],
            role=User.Role.STUDENT,
            market=validated["market"],
            locale=validated["locale"],
            is_verified=False,
        )
        StudentProfile.objects.get_or_create(user=user)
        services.request_otp(user.phone, PhoneOTP.Purpose.VERIFY)
        return user


class VerifyOtpSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    code = serializers.CharField(max_length=12)

    def validate_phone(self, value):
        return normalize_phone(value)

    def save(self, **kwargs):
        phone = self.validated_data["phone"]
        services.verify_otp(phone, PhoneOTP.Purpose.VERIFY, self.validated_data["code"])
        try:
            user = User.objects.get(phone=phone)
        except User.DoesNotExist:
            raise errors.OTPInvalid()
        if not user.is_verified:
            user.is_verified = True
            user.save(update_fields=["is_verified"])
        return user


class ResendOtpSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    purpose = serializers.ChoiceField(
        choices=[PhoneOTP.Purpose.VERIFY, PhoneOTP.Purpose.RESET]
    )

    def validate_phone(self, value):
        return normalize_phone(value)

    def save(self, **kwargs):
        phone = self.validated_data["phone"]
        purpose = self.validated_data["purpose"]
        # Only reveal/act when it makes sense, but never leak account existence.
        if purpose == PhoneOTP.Purpose.VERIFY:
            if User.objects.filter(phone=phone, is_verified=False).exists():
                services.request_otp(phone, purpose)
        elif User.objects.filter(phone=phone).exists():
            services.request_otp(phone, purpose)


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, style={"input_type": "password"})
    new_password = serializers.CharField(
        write_only=True, min_length=8, style={"input_type": "password"}
    )

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        validate_password(value, user=self.context["request"].user)
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        return user


class MasaarTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = User.USERNAME_FIELD  # "phone"

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["full_name"] = user.full_name
        return token

    def validate(self, attrs):
        attrs[self.username_field] = normalize_phone(attrs.get(self.username_field, ""))
        data = super().validate(attrs)
        if not self.user.is_verified:
            raise errors.PhoneNotVerified()
        data["user"] = UserSerializer(self.user).data
        return data


class PasswordResetRequestSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)

    def validate_phone(self, value):
        return normalize_phone(value)

    def save(self, **kwargs):
        phone = self.validated_data["phone"]
        # Generic response regardless of existence to avoid enumeration.
        if User.objects.filter(phone=phone).exists():
            services.request_otp(phone, PhoneOTP.Purpose.RESET)


class PasswordResetConfirmSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    code = serializers.CharField(max_length=12)
    new_password = serializers.CharField(write_only=True, min_length=8, style={"input_type": "password"})

    def validate_phone(self, value):
        return normalize_phone(value)

    def validate_new_password(self, value):
        validate_password(value)
        return value

    def save(self, **kwargs):
        phone = self.validated_data["phone"]
        services.verify_otp(phone, PhoneOTP.Purpose.RESET, self.validated_data["code"])
        try:
            user = User.objects.get(phone=phone)
        except User.DoesNotExist:
            raise errors.OTPInvalid()
        user.set_password(self.validated_data["new_password"])
        # A successful reset also confirms control of the phone.
        if not user.is_verified:
            user.is_verified = True
        user.save(update_fields=["password", "is_verified"])
        return user
