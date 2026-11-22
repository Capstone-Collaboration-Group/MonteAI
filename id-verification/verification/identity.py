import re
import unicodedata
from dataclasses import dataclass

from .errors import VerificationError

DASHES = str.maketrans("‐‑‒–—−", "------")
STUDENT_NUMBER = re.compile(r"\d{2}-\d{5}", re.ASCII)


def normalize_name(value: str) -> str:
    """Version 1: Latin diacritics, case, punctuation and repeated whitespace."""
    value = unicodedata.normalize("NFKD", value)
    value = "".join(c for c in value if not unicodedata.combining(c)).upper()
    # Apostrophes and hyphens join a name; periods separate an initial.
    value = re.sub(r"['’\-]", "", value)
    value = re.sub(r"[.,]", " ", value)
    return " ".join(value.split())


def normalize_number(value: str) -> str:
    value = value.translate(DASHES).strip()
    return re.sub(r"\s*-\s*", "-", value)


@dataclass(frozen=True, repr=False)
class StudentIdentity:
    student_number: str
    first_name: str
    middle_initial: str
    last_name: str
    suffix: str

    @classmethod
    def from_dict(cls, data: object) -> "StudentIdentity":
        if not isinstance(data, dict) or set(data) - {
            "studentNumber",
            "firstName",
            "middleInitial",
            "lastName",
            "suffix",
        }:
            raise VerificationError("invalid_request")

        def field(key: str, maximum: int, required: bool = True) -> str:
            value = data.get(key, "")
            if not isinstance(value, str) or len(value) > maximum:
                raise VerificationError("invalid_request")
            value = value.strip()
            if required and not value:
                raise VerificationError("invalid_request")
            return value

        number = normalize_number(field("studentNumber", 20))
        first = normalize_name(field("firstName", 50))
        last = normalize_name(field("lastName", 50))
        middle = normalize_name(field("middleInitial", 2, False))
        suffix = normalize_name(field("suffix", 10, False))
        if not STUDENT_NUMBER.fullmatch(number):
            raise VerificationError("invalid_request")
        if not all(re.fullmatch(r"[A-Z]+(?: [A-Z]+)*", x) for x in (first, last)):
            raise VerificationError("invalid_request")
        if middle and not re.fullmatch(r"[A-Z]", middle):
            raise VerificationError("invalid_request")
        if suffix not in ("", "JR", "SR", "II", "III", "IV", "V"):
            raise VerificationError("invalid_request")
        return cls(number, first, middle, last, suffix)

    @property
    def name_key(self) -> str:
        # A structured binding, not an ambiguous unordered bag of words.
        return "|".join((self.first_name, self.middle_initial, self.last_name, self.suffix))

    def matches_printed_name(self, text: str) -> bool:
        text = normalize_name(text)
        first = self.first_name
        last = self.last_name
        middle = self.middle_initial
        suffix = self.suffix
        # No edit-distance matching, missing-name inference, or O/0 substitution.
        variants = (
            (first, middle, last, suffix),
            (last, suffix, first, middle),
            (last, first, middle, suffix),
        )
        return text in {" ".join(part for part in parts if part) for parts in variants}
