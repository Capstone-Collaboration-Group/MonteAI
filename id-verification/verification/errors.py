from dataclasses import dataclass


@dataclass
class VerificationError(Exception):
    code: str
    status: int = 400
    outcome: str = "error"
    retry_after: int | None = None


MESSAGES = {
    "invalid_request": "Check the registration details and capture format.",
    "image_too_large": "Capture the ID again at a lower resolution.",
    "unsupported_image": "Capture a JPEG or PNG image of the front of your ID.",
    "authentication_required": "Sign in again before verifying your ID.",
    "email_unverified": "Verify your email, then refresh your session.",
    "origin_not_allowed": "This application is not configured for ID verification.",
    "card_not_found": "Place the entire front of the ID inside the guide and retake.",
    "image_quality": "Retake in even lighting, keeping the card still and in focus.",
    "school_unreadable": "Retake with the school heading clearly visible.",
    "name_unreadable": "Retake with your complete printed name clearly visible.",
    "number_unreadable": "Retake with your student number clearly visible.",
    "template_unmatched": "The capture does not match the supported school-ID design.",
    "student_number_mismatch": "The printed student number does not match registration.",
    "student_name_mismatch": "The printed name does not match registration.",
    "daily_limit": "Today's ID-verification attempt limit has been reached.",
    "user_limit": "Your monthly ID-verification attempt limit has been reached.",
    "monthly_limit": "ID verification has reached its monthly service allowance.",
    "busy": "ID verification is busy. Try again shortly.",
    "verification_timeout": "Verification took too long. Please try again.",
    "service_unavailable": "ID verification is temporarily unavailable.",
    "verification_disabled": "ID verification is temporarily paused.",
}


def retake(code: str) -> VerificationError:
    return VerificationError(code, status=422, outcome="retake")


def unmatched(code: str) -> VerificationError:
    return VerificationError(code, status=422, outcome="unmatched")
