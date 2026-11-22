import pytest

from verification.errors import VerificationError
from verification.identity import StudentIdentity


def test_number_keeps_leading_zeros_and_normalizes_separators(student_dict):
    student_dict["studentNumber"] = " 00 – 00123 "
    assert StudentIdentity.from_dict(student_dict).student_number == "00-00123"


@pytest.mark.parametrize(
    "number", ["2024-00123", "0O-00123", "00-OO123", "00-123", "00-001234", "0000123"]
)
def test_number_is_not_guessed(student_dict, number):
    student_dict["studentNumber"] = number
    with pytest.raises(VerificationError):
        StudentIdentity.from_dict(student_dict)


@pytest.mark.parametrize(
    "name",
    ["MARIA SOFIA C. DELA CRUZ", "Dela Cruz, Maria Sofia C.", "  María  Sofía C Dela Cruz  "],
)
def test_supported_name_forms(student, name):
    assert student.matches_printed_name(name)


@pytest.mark.parametrize(
    "name",
    [
        "MARIA SOFIA DELA CRUZ",
        "MARIA S. C. DELA CRUZ",
        "MARIA SOFIA G DELA CRUZ",
        "MARIA SOFIA C DELA CRUZ JR",
        "SOFIA MARIA C DELA CRUZ",
        "MARIA SOFIA C DELA CRUZ EXTRA",
    ],
)
def test_missing_or_changed_names_do_not_match(student, name):
    assert not student.matches_printed_name(name)


def test_receipt_binding_keeps_field_boundaries(student_dict):
    first = StudentIdentity.from_dict(student_dict)
    student_dict.update(firstName="Maria Sofia C", middleInitial="", lastName="Dela Cruz")
    second = StudentIdentity.from_dict(student_dict)
    assert first.name_key != second.name_key


def test_suffix_and_optional_middle_initial(student_dict):
    student_dict.update(firstName="Jose", middleInitial="", lastName="Dela Cruz", suffix="Jr.")
    student = StudentIdentity.from_dict(student_dict)
    assert student.matches_printed_name("Jose Dela Cruz Jr.")
    assert student.matches_printed_name("Dela Cruz Jr., Jose")
    assert not student.matches_printed_name("Jose Dela Cruz")
