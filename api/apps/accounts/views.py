from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.generics import RetrieveAPIView, RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import StudentProfile
from .permissions import IsStudent
from .serializers import (
    MasaarTokenObtainPairSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    ResendOtpSerializer,
    SignupSerializer,
    StudentProfileSerializer,
    UserSerializer,
    UserUpdateSerializer,
    VerifyOtpSerializer,
    tokens_for_user,
)


class SignupView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "otp_request"
    serializer_class = SignupSerializer

    @extend_schema(request=SignupSerializer, responses={201: OpenApiResponse(description="OTP sent")})
    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {"message": "Verification code sent.", "phone": user.phone},
            status=status.HTTP_201_CREATED,
        )


class VerifyOtpView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "otp_verify"
    serializer_class = VerifyOtpSerializer

    @extend_schema(request=VerifyOtpSerializer, responses={200: UserSerializer})
    def post(self, request):
        serializer = VerifyOtpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response({**tokens_for_user(user), "user": UserSerializer(user).data})


class ResendOtpView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "otp_request"
    serializer_class = ResendOtpSerializer

    @extend_schema(request=ResendOtpSerializer, responses={200: OpenApiResponse(description="OTP sent if applicable")})
    def post(self, request):
        serializer = ResendOtpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"message": "If the number is eligible, a code has been sent."})


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    throttle_scope = "login"
    serializer_class = MasaarTokenObtainPairSerializer


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "otp_request"
    serializer_class = PasswordResetRequestSerializer

    @extend_schema(request=PasswordResetRequestSerializer, responses={200: OpenApiResponse(description="OTP sent if account exists")})
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"message": "If the account exists, a reset code has been sent."})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "otp_verify"
    serializer_class = PasswordResetConfirmSerializer

    @extend_schema(request=PasswordResetConfirmSerializer, responses={200: OpenApiResponse(description="Password updated")})
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"message": "Password updated. You can now sign in."})


class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PasswordChangeSerializer

    @extend_schema(request=PasswordChangeSerializer, responses={200: OpenApiResponse(description="Password changed")})
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"message": "Password updated."})


class MeView(RetrieveUpdateAPIView):
    """GET the current user; PATCH self-service fields (name/email/locale)."""

    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        return UserUpdateSerializer if self.request.method in ("PUT", "PATCH") else UserSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(instance).data)


class StudentProfileView(RetrieveUpdateAPIView):
    """A student's own learning profile (grade level, date of birth)."""

    permission_classes = [IsStudent]
    serializer_class = StudentProfileSerializer

    def get_object(self):
        profile, _ = StudentProfile.objects.get_or_create(user=self.request.user)
        return profile
