"""Pydantic request/response models for the Campus Customs API.

Validation lives here so both registration and login reject bad input the same way,
and the frontend can rely on consistent, well-mannered error messages.
"""

import re

from pydantic import BaseModel, Field, field_validator

# A forgiving-but-sane name: letters (incl. accents), spaces, apostrophes, hyphens, periods.
NAME_RE = re.compile(r"^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' .\-]*$")
# A pragmatic email check — not the full RFC, but enough to catch typos and junk.
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

PASSWORD_MIN = 8
PASSWORD_MAX = 128


class RegisterRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: str = Field(..., max_length=254)
    password: str = Field(..., min_length=PASSWORD_MIN, max_length=PASSWORD_MAX)

    @field_validator("first_name", "last_name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        v = v.strip()
        if not NAME_RE.match(v):
            raise ValueError(
                "A name may hold only letters, spaces, apostrophes, hyphens and periods — "
                "no numerals or curious symbols, Your Grace."
            )
        return v

    @field_validator("email")
    @classmethod
    def _clean_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("That address does not appear to be a proper email, Your Grace.")
        return v

    @field_validator("password")
    @classmethod
    def _check_password(cls, v: str) -> str:
        if v.strip() != v:
            raise ValueError("A password must not begin or end with a blank space.")
        if len(v) < PASSWORD_MIN:
            raise ValueError(f"A password fit for royalty is at least {PASSWORD_MIN} characters.")
        return v


class LoginRequest(BaseModel):
    email: str = Field(..., max_length=254)
    password: str = Field(..., min_length=1, max_length=PASSWORD_MAX)

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: str) -> str:
        return v.strip().lower()


class SizeStock(BaseModel):
    """Stock for one size of one product, read straight from the inventory table."""

    size: str
    quantity: int
    in_stock: bool


class ProductAvailability(BaseModel):
    """What the availability tool returns: real description, price and per-size stock.
    Every value comes from campus_customs.db — the agent must not invent any of it."""

    found: bool
    product_id: str
    name: str | None = None
    description: str | None = None
    price: float | None = None
    colors: list[str] = Field(default_factory=list)
    total_stock: int = 0
    in_stock: bool = False  # True if at least one size has stock
    sizes: list[SizeStock] = Field(default_factory=list)


class ProductCard(BaseModel):
    """A single product the Concierge chooses to show — the subset safe for the chat UI.
    Carries per-size stock so the UI can mark sold-out sizes and out-of-stock items."""

    product_id: str
    name: str
    price: float
    image_url: str
    colors: list[str] = Field(default_factory=list)
    in_stock: bool = True
    sizes: list[SizeStock] = Field(default_factory=list)
    badge: str | None = None  # "hot" | "almost_gone" | None, computed from inventory


class CartItemRequest(BaseModel):
    product_id: str
    size: str
    quantity: int = Field(default=1, ge=1, le=20)
    cart_id: str | None = None  # anonymous cart token (ignored when signed in)


class CartLine(BaseModel):
    product_id: str
    name: str
    price: float
    image_url: str
    size: str
    quantity: int


class Cart(BaseModel):
    items: list[CartLine] = Field(default_factory=list)
    count: int = 0
    subtotal: float = 0.0


class PickupRequestInput(BaseModel):
    product_id: str
    size: str | None = None
    pickup_date: str = Field(..., min_length=1, max_length=40)
    someone_else: bool = False
    alternate_name: str | None = Field(default=None, max_length=80)
    cart_id: str | None = None


class ChatTurn(BaseModel):
    """One prior message, sent up from the browser so the agent has conversation context."""

    role: str  # "user" or "assistant"
    content: str


class PageContext(BaseModel):
    """Where the guest is on the site right now, passed up so the agent can resolve 'this item'."""

    path: str = ""  # e.g. "/products/basic-hoodie-big-yale" or "/about"
    product_id: str | None = None  # set when the guest is on a product detail page


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)
    page: PageContext | None = None


class HistoryMessage(BaseModel):
    role: str
    content: str
    products: list[ProductCard] = Field(default_factory=list)


class ChatHistory(BaseModel):
    messages: list[HistoryMessage] = Field(default_factory=list)


class AgentOutput(BaseModel):
    """What the model itself returns. It names products by id only; the backend turns those
    ids into authoritative ProductCards from the DB, so prices/images can never be hallucinated."""

    reply: str = Field(..., description="The friendly message to show the guest.")
    product_ids: list[str] = Field(
        default_factory=list, description="Ids of products to show as cards, in the order to display them."
    )
    follow_ups: list[str] = Field(
        default_factory=list, description="2-3 short suggested questions the guest might tap next."
    )


class ChatReply(BaseModel):
    """The agent's structured answer as sent to the browser: prose, product cards, follow-ups."""

    reply: str
    products: list[ProductCard] = Field(default_factory=list)
    follow_ups: list[str] = Field(default_factory=list)


class PublicUser(BaseModel):
    """Everything the frontend is allowed to see — never the hash, never the salt."""

    id: int
    first_name: str
    last_name: str
    email: str


class AuthResponse(BaseModel):
    user: PublicUser
    token: str
    greeting: str
