"""The seed is the product's default taxonomy, so its shape is a contract.

Runs with --no-demo: the generated demo activity (hundreds of teachers, thousands
of bookings) is far too slow for a test and adds nothing to what's asserted here.
"""
import pytest
from django.core.management import call_command

from apps.catalog.models import (
    LessonCategory,
    StageGroup,
    StagePricingRule,
    StageSubject,
    Vertical,
)
from apps.markets.models import Market
from apps.teachers.models import TeacherProfile, TeacherStage
from apps.teachers.stage_setup import min_card_price

pytestmark = pytest.mark.django_db

EXPECTED_STAGES = [
    "PRIMARY",
    "PREPARATORY",
    "SECONDARY",
    "COLLEGE",
    "INTL_CURRICULA",
    "INTL_EXAMS",
]


@pytest.fixture(scope="module")
def _seeded(django_db_setup, django_db_blocker):
    """Seed once for the whole module, inside a transaction we roll back.

    The seed writes real rows, so without the rollback it leaks into every other
    test's database; without the module scope it re-runs per test and costs ~7s
    each. Each test still gets its own nested transaction on top of this one.
    """
    from django.db import transaction

    with django_db_blocker.unblock():
        outer = transaction.atomic()
        outer.__enter__()
        call_command("seed", no_demo=True, verbosity=0)
        try:
            yield
        finally:
            transaction.set_rollback(True)
            outer.__exit__(None, None, None)


@pytest.fixture
def stages(_seeded):
    return list(Vertical.objects.select_related("group").order_by("order"))


def test_seeds_the_five_stage_taxonomy(stages):
    assert [s.code for s in stages] == EXPECTED_STAGES


def test_international_stages_share_one_display_group(stages):
    grouped = [s for s in stages if s.group_id]
    assert {s.code for s in grouped} == {"INTL_CURRICULA", "INTL_EXAMS"}
    assert len({s.group_id for s in grouped}) == 1
    assert grouped[0].group.name_ar == "التعليم الدولي"
    assert StageGroup.objects.count() == 1


def test_grouped_stages_are_contiguous_in_order(stages):
    """Clients open the group header at the first stage carrying it, so a gap
    would render the header twice."""
    positions = [i for i, s in enumerate(stages) if s.group_id]
    assert positions == list(range(positions[0], positions[0] + len(positions)))


def test_grouped_stages_name_their_own_track(stages):
    by_code = {s.code: s for s in stages}
    assert by_code["INTL_CURRICULA"].child_label_ar == "المنهج"
    assert by_code["INTL_EXAMS"].child_label_ar == "الاختبار"
    # BRANCH/FACULTY stages leave it blank — the clients translate those.
    assert by_code["SECONDARY"].child_label_ar == ""


def test_every_stage_needing_a_track_has_some(stages):
    for stage in stages:
        has_tracks = stage.tracks.exists()
        assert has_tracks == (stage.child_kind != Vertical.ChildKind.NONE), stage.code


def test_british_curriculum_is_split_into_igcse_and_a_level(stages):
    curricula = next(s for s in stages if s.code == "INTL_CURRICULA")
    names = set(curricula.tracks.values_list("name_en", flat=True))
    assert {"British IGCSE", "British A Level"} <= names


def test_every_market_prices_every_stage(stages):
    """A missing floor is what lets demo data and teacher cards invent a price."""
    for market in Market.objects.filter(code__in=["EG", "SA"]):
        priced = set(
            StagePricingRule.objects.filter(market=market).values_list("vertical_id", flat=True)
        )
        assert priced == {s.id for s in stages}, market.code


def test_international_floors_are_above_the_school_floors(_seeded):
    floors = {
        r.vertical.code: r.min_price_minor
        for r in StagePricingRule.objects.select_related("vertical").filter(market__code="EG")
    }
    assert floors["INTL_CURRICULA"] > floors["COLLEGE"] > floors["SECONDARY"]
    assert floors["INTL_EXAMS"] > floors["INTL_CURRICULA"]


def test_no_seeded_card_is_below_its_own_floor(_seeded):
    """The failure this guards: a card priced under the floor is silently
    unbookable and drags its whole profile out of discovery."""
    underpriced = [
        card.id
        for card in TeacherStage.objects.select_related("teacher")
        if card.price_minor < min_card_price(card.teacher.market_id, card.vertical_id)
    ]
    assert underpriced == []


def test_every_card_only_teaches_subjects_its_stage_offers(_seeded):
    offers: dict[tuple, set] = {}
    for ss in StageSubject.objects.all():
        offers.setdefault((ss.vertical_id, ss.track_id), set()).add(ss.subject_id)

    for card in TeacherStage.objects.prefetch_related("subjects"):
        chosen = {s.subject_id for s in card.subjects.all()}
        assert chosen <= offers.get((card.vertical_id, card.track_id), set()), card.id


def test_every_stage_has_a_published_teacher(stages):
    """Otherwise a stage chip leads students to an empty result page."""
    for stage in stages:
        assert (
            TeacherProfile.objects.filter(is_published=True, stages__vertical=stage)
            .distinct()
            .exists()
        ), stage.code


def test_the_dead_lesson_category_table_stays_empty(_seeded):
    """LessonCategory.vertical is PROTECT, so any row here makes stage deletion
    in /admin/catalog impossible."""
    assert LessonCategory.objects.count() == 0
