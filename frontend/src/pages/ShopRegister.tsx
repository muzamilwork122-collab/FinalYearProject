import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Locate,
  Store,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { registerShopkeeper, setShopSession, type ShopRegisterPayload } from "@/lib/shopApi";

const STEPS = ["Account Setup", "Business Details", "Verification Details"] as const;

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const NAME_RE = /^[A-Za-z\u00C0-\u024F]+(?:[ '-][A-Za-z\u00C0-\u024F]+)*$/;

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "An uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "A lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "A number", test: (value: string) => /\d/.test(value) },
  { label: "A special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

const CATEGORIES = [
  "Mobile phone repair",
  "Screen replacement specialist",
  "Electronics repair",
  "Mobile accessories",
  "Multi-brand service center",
  "Other",
];

const DOCUMENT_TYPES = [
  "National ID Card",
  "Passport",
  "Driving License",
  "Business Registration",
  "Shop License",
];

const ALLOWED_DOC_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_DOC_SIZE_BYTES = 5 * 1024 * 1024;

const inputClass =
  "w-full rounded-[var(--radius)] border border-input bg-card px-3.5 py-2.5 text-sm text-foreground " +
  "placeholder:text-muted-foreground/60 outline-none transition-colors " +
  "focus:border-accent focus:ring-2 focus:ring-accent/30";

const labelClass = "block text-sm font-medium text-foreground mb-1.5";

interface FormState {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  shopName: string;
  category: string;
  shopPhone: string;
  website: string;
  address: string;
  city: string;
  country: string;
  openingHours: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  documentType: string;
  documentNumber: string;
  documentImage: string;
}

const initialForm: FormState = {
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  shopName: "",
  category: CATEGORIES[0],
  shopPhone: "",
  website: "",
  address: "",
  city: "",
  country: "",
  openingHours: "",
  description: "",
  latitude: null,
  longitude: null,
  documentType: DOCUMENT_TYPES[0],
  documentNumber: "",
  documentImage: "",
};

function Stepper({ current }: { current: number }) {
  return (
    <div className="mb-10 flex items-center justify-between">
      {STEPS.map((label, index) => {
        const isDone = index < current;
        const isActive = index === current;
        return (
          <div key={label} className="flex flex-1 flex-col items-center text-center">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-[var(--radius)] border text-sm font-semibold transition-colors ${
                isDone
                  ? "border-accent bg-accent text-accent-foreground"
                  : isActive
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-card text-muted-foreground"
              }`}
            >
              {isDone ? <Check className="h-4 w-4" /> : index + 1}
            </span>
            <span
              className={`mt-2 text-xs font-medium uppercase tracking-wide ${
                isActive || isDone ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PasswordChecklist({ password }: { password: string }) {
  if (!password) return null;
  return (
    <ul className="mt-2 grid gap-1 sm:grid-cols-2">
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(password);
        return (
          <li
            key={rule.label}
            className={`flex items-center gap-1.5 text-xs ${passed ? "text-success" : "text-muted-foreground"}`}
          >
            {passed ? <Check size={13} /> : <X size={13} className="text-muted-foreground/60" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}

const ShopRegister = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof FormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const validateAccount = (): boolean => {
    if (!NAME_RE.test(form.firstName.trim())) return reject("Enter a valid first name");
    if (!NAME_RE.test(form.lastName.trim())) return reject("Enter a valid last name");
    if (form.username.trim().length < 3) return reject("Username must be at least 3 characters");
    if (!EMAIL_RE.test(form.email.trim())) return reject("Enter a valid email address");
    if (form.phone.trim().length < 7) return reject("Enter a valid phone number");
    const failedRule = PASSWORD_RULES.find((rule) => !rule.test(form.password));
    if (failedRule) return reject(`Password needs: ${failedRule.label.toLowerCase()}`);
    if (form.password !== form.confirmPassword) return reject("Passwords do not match");
    return true;
  };

  const validateBusiness = (): boolean => {
    if (form.shopName.trim().length < 2) return reject("Enter your shop name");
    if (form.address.trim().length < 5) return reject("Enter your shop address");
    return true;
  };

  const validateVerification = (): boolean => {
    if (!form.documentType) return reject("Select a document type");
    if (form.documentNumber.trim().length < 3) return reject("Enter your document number");
    if (!form.documentImage) return reject("Upload a photo of your document");
    return true;
  };

  function reject(message: string): boolean {
    toast.error(message);
    return false;
  }

  const goNext = () => {
    if (step === 0 && !validateAccount()) return;
    if (step === 1 && !validateBusiness()) return;
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const goBack = () => setStep((prev) => Math.max(prev - 1, 0));

  const detectLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation is not supported by your browser");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=en`,
            { headers: { "User-Agent": "ScreenAI-FYP/1.0" } },
          );
          const data = await response.json();
          const address = data?.address ?? {};
          setForm((prev) => ({
            ...prev,
            latitude,
            longitude,
            city: prev.city || address.city || address.town || address.village || address.county || "",
            country: prev.country || address.country || "",
            address: prev.address || data?.display_name || "",
          }));
          toast.success("Location captured");
        } catch {
          setForm((prev) => ({ ...prev, latitude, longitude }));
          toast.success("Coordinates captured");
        }
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("Could not get your location. Please allow location access.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const geocodeAddress = async () => {
    if (form.address.trim().length < 5) return toast.error("Enter your shop address first");
    setLocating(true);
    try {
      const query = [form.address, form.city, form.country].filter(Boolean).join(", ");
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
        { headers: { "User-Agent": "ScreenAI-FYP/1.0" } },
      );
      const data = await response.json();
      if (Array.isArray(data) && data[0]?.lat) {
        setForm((prev) => ({ ...prev, latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) }));
        toast.success("Address pinned on the map");
      } else {
        toast.error("Could not find that address. Try 'Use my current location'.");
      }
    } catch {
      toast.error("Geocoding failed. Try again.");
    }
    setLocating(false);
  };

  const handleDocumentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_DOC_TYPES.includes(file.type)) return toast.error("Upload a JPG, PNG or WebP image");
    if (file.size > MAX_DOC_SIZE_BYTES) return toast.error("Document image must be under 5 MB");
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, documentImage: String(reader.result) }));
    reader.onerror = () => toast.error("Could not read that file");
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!validateVerification()) return;
    setSubmitting(true);
    try {
      const payload: ShopRegisterPayload = {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        shop_name: form.shopName.trim(),
        category: form.category,
        shop_phone: form.shopPhone.trim() || undefined,
        website: form.website.trim() || undefined,
        address: form.address.trim(),
        city: form.city.trim() || undefined,
        country: form.country.trim() || undefined,
        opening_hours: form.openingHours.trim() || undefined,
        description: form.description.trim() || undefined,
        latitude: form.latitude,
        longitude: form.longitude,
        document_type: form.documentType,
        document_number: form.documentNumber.trim(),
        document_image: form.documentImage,
      };
      const result = await registerShopkeeper(payload);
      setShopSession(result.token, result.shopkeeper);
      toast.success("Application submitted! It's now awaiting admin review.");
      navigate("/shop");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit your application");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
            <Store className="h-3.5 w-3.5" /> Shop partner registration
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground">
            List your repair shop
          </h1>
          <p className="mt-2 text-muted-foreground">
            Approved partners appear first on the map when customers search nearby.
          </p>
        </div>

        <div className="surface p-6 sm:p-8">
          <Stepper current={step} />

          {step === 0 && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="First Name" required>
                <input className={inputClass} value={form.firstName} onChange={set("firstName")} placeholder="Your first name" />
              </Field>
              <Field label="Last Name" required>
                <input className={inputClass} value={form.lastName} onChange={set("lastName")} placeholder="Your last name" />
              </Field>
              <Field label="User Name" required>
                <input className={inputClass} value={form.username} onChange={set("username")} placeholder="Choose a username" />
              </Field>
              <Field label="Email" required>
                <input className={inputClass} type="email" value={form.email} onChange={set("email")} placeholder="you@email.com" />
              </Field>
              <Field label="Phone" required>
                <input className={inputClass} value={form.phone} onChange={set("phone")} placeholder="+1 (000) 000-0000" />
              </Field>
              <Field label="Password" required>
                <div className="relative">
                  <input
                    className={`${inputClass} pr-11`}
                    type={showPass ? "text" : "password"}
                    value={form.password}
                    onChange={set("password")}
                    placeholder="Create a strong password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
              <Field label="Confirm Password" required>
                <div className="relative">
                  <input
                    className={`${inputClass} pr-11`}
                    type={showConfirm ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={set("confirmPassword")}
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {form.confirmPassword && (
                  <p className={`mt-1.5 text-xs font-medium ${form.password === form.confirmPassword ? "text-success" : "text-destructive"}`}>
                    {form.password === form.confirmPassword ? "Passwords match" : "Passwords do not match"}
                  </p>
                )}
              </Field>
              <div className="sm:col-span-2">
                <PasswordChecklist password={form.password} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Shop Name" required>
                <input className={inputClass} value={form.shopName} onChange={set("shopName")} placeholder="e.g. QuickFix Mobiles" />
              </Field>
              <Field label="Category">
                <select className={inputClass} value={form.category} onChange={set("category")}>
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </Field>
              <Field label="Shop Phone">
                <input className={inputClass} value={form.shopPhone} onChange={set("shopPhone")} placeholder="Shop contact number" />
              </Field>
              <Field label="Website">
                <input className={inputClass} value={form.website} onChange={set("website")} placeholder="https://" />
              </Field>
              <Field label="Shop Address" required className="sm:col-span-2">
                <textarea className={`${inputClass} min-h-[72px] resize-y`} value={form.address} onChange={set("address")} placeholder="Street, area, landmark" />
              </Field>
              <Field label="City">
                <input className={inputClass} value={form.city} onChange={set("city")} placeholder="City" />
              </Field>
              <Field label="Country">
                <input className={inputClass} value={form.country} onChange={set("country")} placeholder="Country" />
              </Field>
              <Field label="Opening Hours">
                <input className={inputClass} value={form.openingHours} onChange={set("openingHours")} placeholder="e.g. Mon-Sat 10am-9pm" />
              </Field>
              <Field label="Short Description">
                <input className={inputClass} value={form.description} onChange={set("description")} placeholder="What you specialize in" />
              </Field>
              <div className="sm:col-span-2">
                <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-dashed border-border bg-secondary/40 p-4">
                  <p className="flex-1 text-xs text-muted-foreground">
                    Pin your shop so it shows in the right spot on the map.
                    {form.latitude != null && form.longitude != null && (
                      <span className="ml-1 font-medium text-success">
                        Pinned ({form.latitude.toFixed(4)}, {form.longitude.toFixed(4)})
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={detectLocation}
                    disabled={locating}
                    className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
                  >
                    {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Locate className="h-3.5 w-3.5" />}
                    Use my current location
                  </button>
                  <button
                    type="button"
                    onClick={geocodeAddress}
                    disabled={locating}
                    className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
                  >
                    Pin from address
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Document Type" required>
                <select className={inputClass} value={form.documentType} onChange={set("documentType")}>
                  {DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </Field>
              <Field label="Document Number" required>
                <input className={inputClass} value={form.documentNumber} onChange={set("documentNumber")} placeholder="ID / license number" />
              </Field>
              <Field label="Document Image" required className="sm:col-span-2">
                {form.documentImage ? (
                  <div className="relative overflow-hidden rounded-[var(--radius)] border border-border">
                    <img src={form.documentImage} alt="Uploaded document" className="max-h-64 w-full object-contain bg-secondary/40" />
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, documentImage: "" }))}
                      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/70 text-background transition-colors hover:bg-foreground"
                      aria-label="Remove document"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius)] border border-dashed border-border bg-secondary/40 px-4 py-10 text-center transition-colors hover:bg-secondary/60">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Click to upload your document</span>
                    <span className="text-xs text-muted-foreground">JPG, PNG or WebP — up to 5 MB</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleDocumentUpload} />
                  </label>
                )}
              </Field>
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Your application will be reviewed by our team. You'll see the decision on your shop dashboard.
              </p>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
            {step > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : (
              <span />
            )}

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Submit application
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already a partner?{" "}
          <Link to="/shop" className="font-medium text-foreground underline underline-offset-2">
            Sign in to your shop dashboard
          </Link>
        </p>
      </main>
      <Footer />
    </div>
  );
};

function Field({
  label,
  required = false,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className={labelClass}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

export default ShopRegister;
