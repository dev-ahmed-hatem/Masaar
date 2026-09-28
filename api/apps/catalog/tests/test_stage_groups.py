"""Stage groups: the display-only header over sibling stages, and the custom
track labels that go with a GROUPED stage."""
import pytest

from apps.accounts.models import User
from apps.catalog.models import StageGroup, Vertical
from apps.markets.models import Market

pytestmark = pytest.mark.django_db

STAGES = "/api/catalog/verticals/"
ADMIN_GROUPS = "/api/admin/stage-groups/"
ADMIN_STAGES = "/api/admin/stages/"


@pytest.fixture
def eg():
    return Market.objects.update_or_create(
        code="EG", defaults={"name": "Egypt", "currency": "EGP", "timezone": "Africa/Cairo"}
    )[0]


@pytest.fixture
def staff(eg):
    return User.objects.create_user(
        phone="+201900000001", password="x", full_name="Mod",
        role=User.Role.MODERATOR, market=eg,
    )


@pytest.fixture
def student(eg):
    return User.objects.create_user(
        phone="+201900000002", password="x", full_name="Student",
        role=User.Role.STUDENT, market=eg,
    )


@pytest.fixture
def tree():
    """Four ungrouped stages, then two under one group — the seeded shape."""
    group = StageGroup.objects.create(
        code="INTERNATIONAL", name_en="International Education", name_ar="التعليم الدولي", order=1
    )
    stages = {
        "primary": Vertical.objects.create(
            code=Vertical.Code.PRIMARY, name_en="Primary", name_ar="ابتدائي", order=1
        ),
        "secondary": Vertical.objects.create(
            code=Vertical.Code.SECONDARY, name_en="Secondary", name_ar="ثانوي", order=3,
            child_kind=Vertical.ChildKind.BRANCH,
        ),
        "curricula": Vertical.objects.create(
            code=Vertical.Code.INTL_CURRICULA, name_en="International Curricula",
            name_ar="المناهج الدولية", order=5, group=group,
            child_kind=Vertical.ChildKind.GROUPED,
            child_label_en="Curriculum", child_label_ar="المنهج",
        ),
        "exams": Vertical.objects.create(
            code=Vertical.Code.INTL_EXAMS, name_en="International Exams",
            name_ar="الاختبارات الدولية", order=6, group=group,
            child_kind=Vertical.ChildKind.GROUPED,
            child_label_en="Exam", child_label_ar="الاختبار",
        ),
    }
    return {"group": group, **stages}


def test_public_stage_list_carries_its_group_inline(api, tree):
    rows = api.get(STAGES).data
    by_code = {r["code"]: r for r in rows}

    assert by_code["PRIMARY"]["group"] is None
    assert by_code["INTL_CURRICULA"]["group"]["name_ar"] == "التعليم الدولي"
    assert by_code["INTL_EXAMS"]["group"]["id"] == tree["group"].id
    # The custom track label travels with the stage, so clients never hardcode it.
    assert by_code["INTL_EXAMS"]["child_label_ar"] == "الاختبار"
    assert by_code["SECONDARY"]["child_label_ar"] == ""


def test_grouped_stages_are_contiguous_in_display_order(api, tree):
    codes = [r["code"] for r in api.get(STAGES).data]
    grouped = [i for i, r in enumerate(api.get(STAGES).data) if r["group"]]
    assert codes == ["PRIMARY", "SECONDARY", "INTL_CURRICULA", "INTL_EXAMS"]
    assert grouped == list(range(grouped[0], grouped[0] + len(grouped)))


def test_deactivating_a_group_stops_grouping_but_keeps_its_stages(api, tree):
    tree["group"].is_active = False
    tree["group"].save(update_fields=["is_active"])

    rows = {r["code"]: r for r in api.get(STAGES).data}
    assert rows["INTL_CURRICULA"]["group"] is None
    assert "INTL_CURRICULA" in rows  # the stage itself is untouched


def test_group_crud_is_staff_only(api, student, staff, tree):
    api.force_authenticate(student)
    assert api.get(ADMIN_GROUPS).status_code == 403

    api.force_authenticate(staff)
    res = api.post(
        ADMIN_GROUPS,
        {"code": "VOCATIONAL", "name_en": "Vocational", "name_ar": "التعليم المهني", "order": 2},
        format="json",
    )
    assert res.status_code == 201
    new_id = res.data["id"]

    res = api.patch(f"{ADMIN_GROUPS}{new_id}/", {"name_ar": "مهني"}, format="json")
    assert res.status_code == 200
    assert res.data["name_ar"] == "مهني"

    assert api.delete(f"{ADMIN_GROUPS}{new_id}/").status_code == 204


def test_deleting_a_group_in_use_is_refused(api, staff, tree):
    api.force_authenticate(staff)
    res = api.delete(f"{ADMIN_GROUPS}{tree['group'].id}/")
    assert res.status_code == 409
    assert StageGroup.objects.filter(id=tree["group"].id).exists()


def test_moderator_assigns_a_group_and_custom_labels(api, staff, tree):
    api.force_authenticate(staff)
    res = api.post(
        ADMIN_STAGES,
        {
            "code": "VOCATIONAL", "name_en": "Vocational", "name_ar": "التعليم المهني",
            "group_id": tree["group"].id, "child_kind": "GROUPED",
            "child_label_en": "Trade", "child_label_ar": "التخصص", "order": 7,
        },
        format="json",
    )
    assert res.status_code == 201
    # Written by id, read back nested — one Stage shape for every client.
    assert res.data["group"]["code"] == "INTERNATIONAL"
    assert res.data["child_label_ar"] == "التخصص"


def test_a_grouped_stage_needs_a_label_in_both_languages(api, staff, tree):
    api.force_authenticate(staff)
    res = api.post(
        ADMIN_STAGES,
        {"code": "VOCATIONAL", "name_en": "Vocational", "name_ar": "مهني",
         "child_kind": "GROUPED", "child_label_en": "Trade", "order": 7},
        format="json",
    )
    assert res.status_code == 400
    assert "child_label_ar" in str(res.data)
