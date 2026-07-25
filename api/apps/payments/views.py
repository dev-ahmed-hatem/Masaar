from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsStudent

from . import services
from .models import LedgerEntry
from .serializers import LedgerEntrySerializer, WalletSerializer


class WalletView(APIView):
    """The authenticated student's wallet balance and recent ledger."""

    permission_classes = [IsStudent]

    def get(self, request):
        wallet = services.get_or_create_wallet(request.user)
        entries = LedgerEntry.objects.filter(wallet=wallet).select_related("booking")[:25]
        return Response(
            {
                "wallet": WalletSerializer(wallet).data,
                "ledger": LedgerEntrySerializer(entries, many=True).data,
            }
        )
