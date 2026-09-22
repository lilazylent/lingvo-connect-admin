import re
from datetime import date, datetime
from typing import Literal, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    TypeAdapter,
    field_validator,
    model_validator,
)

from app.models import ApplicationSource, ApplicationStatus, AuthStage, Role


class UserView(BaseModel):
    id: str
    email: EmailStr
    display_name: str
    role: Role
    is_active: bool
    must_change_password: bool
    two_factor_enabled: bool
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None

    model_config = {"from_attributes": True}


class AuthState(BaseModel):
    stage: AuthStage
    user: UserView


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=1024)


class PasswordChangeRequest(BaseModel):
    current_password: str | None = Field(default=None, max_length=1024)
    new_password: str = Field(min_length=10, max_length=1024)


class TotpCodeRequest(BaseModel):
    code: str = Field(pattern=r"^\d{6}$")


class TotpSetupView(BaseModel):
    manual_key: str
    qr_data_uri: str


class RecoveryRequest(BaseModel):
    code: str = Field(min_length=8, max_length=128)


class RecoveryCodesView(BaseModel):
    recovery_codes: list[str]
    warning: str


class UserCreateRequest(BaseModel):
    email: EmailStr
    display_name: str = Field(default="", max_length=160)
    role: Role


class UserCreateView(BaseModel):
    user: UserView
    temporary_password: str
    warning: str


class UserInvitationCreateRequest(BaseModel):
    email: EmailStr
    role: Role = Role.MANAGER


class UserInvitationView(BaseModel):
    id: str
    email: EmailStr
    role: Role
    expires_at: datetime
    created_at: datetime
    status: Literal["PENDING", "EXPIRED"]


class UserInvitationCreateView(BaseModel):
    invitation: UserInvitationView
    registration_url: str


class UserInvitationPublicView(BaseModel):
    email: EmailStr
    role: Role
    expires_at: datetime


class UserInvitationAcceptRequest(BaseModel):
    display_name: str = Field(default="", max_length=160)
    password: str = Field(min_length=10, max_length=1024)


class UserUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=160)
    role: Role | None = None
    is_active: bool | None = None
    must_change_password: bool | None = None


class UserPreferencesView(BaseModel):
    interface_theme: Literal["system", "light", "dark"]


class UserPreferencesUpdate(BaseModel):
    interface_theme: Literal["system", "light", "dark"]


class TemporaryPasswordView(BaseModel):
    temporary_password: str
    warning: str


class MessageView(BaseModel):
    message: str


CONTACT_METHODS = Literal["email", "phone", "messenger"]
SERVICE_CODES = Literal[
    "written_translation",
    "interpreting",
    "certification",
    "localization",
    "additional",
    "not_sure",
]
CONTROL_CHARACTERS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
EMAIL_ADAPTER = TypeAdapter(EmailStr)


class PublicApplicationCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(min_length=2, max_length=100)
    contact_method: CONTACT_METHODS
    contact: str = Field(min_length=3, max_length=320)
    requested_service: SERVICE_CODES
    message: str = Field(min_length=10, max_length=4000)
    consent_accepted: bool
    consent_version: str = Field(min_length=3, max_length=64)
    source_identifier: str | None = Field(default=None, max_length=80)
    utm_source: str | None = Field(default=None, max_length=100)
    utm_medium: str | None = Field(default=None, max_length=100)
    utm_campaign: str | None = Field(default=None, max_length=150)
    utm_content: str | None = Field(default=None, max_length=150)
    utm_term: str | None = Field(default=None, max_length=150)
    website: str = Field(default="", max_length=200)
    form_started_at: datetime | None = None

    @field_validator(
        "name",
        "contact",
        "message",
        "consent_version",
        "source_identifier",
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "website",
    )
    @classmethod
    def reject_control_characters(cls, value: str | None) -> str | None:
        if value is not None and CONTROL_CHARACTERS.search(value):
            raise ValueError("Поле содержит недопустимые символы")
        return value

    @model_validator(mode="after")
    def validate_contact_and_consent(self) -> Self:
        if not self.consent_accepted:
            raise ValueError("Необходимо согласие на обработку персональных данных")
        if self.contact_method == "email":
            self.contact = str(EMAIL_ADAPTER.validate_python(self.contact)).lower()
        elif self.contact_method == "phone":
            digits = re.sub(r"\D", "", self.contact)
            if len(digits) < 7 or len(digits) > 15:
                raise ValueError("Проверьте формат телефона")
        return self


class ApplicationCreatedView(BaseModel):
    id: str
    number: str
    created_at: datetime
    message: str = "Заявка принята"


class UserSummaryView(BaseModel):
    id: str
    display_name: str
    email: EmailStr


class ApplicationView(BaseModel):
    id: str
    number: str
    name: str
    contact_method: str
    contact: str
    email: str | None
    phone: str | None
    company: str | None
    requested_service: str
    source_language: str | None
    target_language: str | None
    message: str
    desired_date: date | None
    status_code: ApplicationStatus
    responsible_manager: UserSummaryView | None
    internal_summary: str | None
    source: ApplicationSource
    source_identifier: str | None
    submitted_at: datetime
    created_at: datetime
    updated_at: datetime
    version: int


class ApplicationListView(BaseModel):
    items: list[ApplicationView]
    page: int
    page_size: int
    total: int
    pages: int


class ManualApplicationCreate(BaseModel):
    """Fast internal intake: business details may be completed later."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(default="", max_length=100)
    contact_method: CONTACT_METHODS = "email"
    contact: str = Field(default="", max_length=320)
    company: str | None = Field(default=None, max_length=200)
    requested_service: SERVICE_CODES = "not_sure"
    source_language: str | None = Field(default=None, max_length=80)
    target_language: str | None = Field(default=None, max_length=80)
    message: str = Field(default="", max_length=4000)
    desired_date: date | None = None
    responsible_user_id: str | None = None


class ApplicationUpdateRequest(BaseModel):
    """Editable operational data. None means clear for nullable fields; omitted means unchanged."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(default="", max_length=100)
    contact_method: CONTACT_METHODS = "email"
    contact: str = Field(default="", max_length=320)
    requested_service: SERVICE_CODES = "not_sure"
    message: str = Field(default="", max_length=4000)
    company: str | None = Field(default=None, max_length=200)
    source_language: str | None = Field(default=None, max_length=80)
    target_language: str | None = Field(default=None, max_length=80)
    desired_date: date | None = None
    internal_summary: str | None = Field(default=None, max_length=6000)
    responsible_user_id: str | None = None
    version: int = Field(ge=1)


class ApplicationStatusRequest(BaseModel):
    status_code: ApplicationStatus


class ApplicationCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=6000)


class ApplicationCommentUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=6000)


class ApplicationCommentView(BaseModel):
    id: str
    body: str
    author: UserSummaryView
    created_at: datetime
    edited_at: datetime | None


class ApplicationFileView(BaseModel):
    id: str
    original_name: str
    mime_type: str
    size_bytes: int
    uploader: UserSummaryView | None
    uploaded_at: datetime


class ApplicationActivityView(BaseModel):
    id: str
    event_type: str
    event_data: dict
    actor: UserSummaryView | None
    created_at: datetime


class ApplicationDetailView(ApplicationView):
    comments: list[ApplicationCommentView]
    files: list[ApplicationFileView]
    activity: list[ApplicationActivityView]


class DashboardSummaryView(BaseModel):
    new: int
    in_progress: int
    unassigned: int
    total: int
    recent: list[ApplicationView]
