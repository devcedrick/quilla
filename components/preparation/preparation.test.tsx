// @vitest-environment happy-dom
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { PreparationForm } from "./preparation-form";
import { PreparationContent } from "./preparation-content";
import { ApplicationAccessBoundary } from "@/components/auth/application-access-boundary";
import type { CurrentAccess } from "@/convex/lib/userAccess";
import type { Id } from "@/convex/_generated/dataModel";
import type { PreparationPreferences } from "@/lib/preparation";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  loading: false,
  preferences: { preferredLevel: null, targetExamDate: null } as
    PreparationPreferences | undefined,
  queryError: false,
  access: undefined as CurrentAccess | undefined,
}));
vi.mock("convex/react", () => ({
  useMutation: () => mocks.save,
  useConvexAuth: () => ({
    isLoading: mocks.loading,
    isAuthenticated: !mocks.loading,
  }),
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) => {
    if (getFunctionName(ref) === "users:currentAccess") return mocks.access;
    if (mocks.queryError) throw new Error("provider unavailable");
    return getFunctionName(ref).startsWith("users:")
      ? mocks.preferences
      : { status: "diagnostic_required", level: "professional" };
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/auth/sign-out", () => ({
  SignOut: () => <button>Sign out</button>,
}));
let view: ReactTestRenderer;
const initial: PreparationPreferences = {
  preferredLevel: null,
  targetExamDate: null,
};
async function renderForm(editing = false, preferences = initial) {
  await act(async () => {
    view = create(
      <PreparationForm initialPreferences={preferences} editing={editing} />,
    );
  });
}
async function choose(level = "professional") {
  await act(async () =>
    view.root
      .findByProps({ value: level, name: "preferredLevel" })
      .props.onChange(),
  );
}
async function submit() {
  await act(async () =>
    view.root.findByType("form").props.onSubmit({ preventDefault() {} }),
  );
}
async function reviewSetup() {
  await submit();
  await submit();
  expect(mocks.save).not.toHaveBeenCalled();
}
async function clickButton(label: string) {
  await act(async () =>
    view.root
      .findAllByType("button")
      .find((button) => button.props.children === label)!
      .props.onClick(),
  );
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
  mocks.loading = false;
  mocks.preferences = initial;
  mocks.queryError = false;
  mocks.access = {
    status: "active",
    userId: "profile-a" as Id<"users">,
    role: "user",
  };
  mocks.save.mockResolvedValue({
    preferredLevel: "professional",
    targetExamDate: null,
  });
});
afterEach(async () => {
  if (view) await act(async () => view.unmount());
});

describe("preparation form", () => {
  it("requires an explicit selection and renders both truthful subject boundaries", async () => {
    await renderForm();
    expect(
      view.root
        .findAllByProps({ type: "radio" })
        .every((radio) => !radio.props.checked),
    ).toBe(true);
    await submit();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(JSON.stringify(view.toJSON())).toContain("Choose an exam level.");
    expect(JSON.stringify(view.toJSON())).toContain(
      "excludes Clerical Ability",
    );
    expect(JSON.stringify(view.toJSON())).toContain(
      "excludes Analytical Ability",
    );
  });
  it("saves first setup before navigating to the introduction", async () => {
    await renderForm();
    await choose();
    await reviewSetup();
    await submit();
    expect(mocks.save).toHaveBeenCalledWith({ preferredLevel: "professional" });
    expect(mocks.replace).toHaveBeenCalledWith("/diagnostic");
  });
  it("requires acknowledgement for a changed level and preserves an expired date", async () => {
    await renderForm(true, {
      preferredLevel: "professional",
      targetExamDate: "2020-01-01",
    });
    await choose("subprofessional");
    await submit();
    expect(mocks.save).not.toHaveBeenCalled();
    await act(async () =>
      view.root
        .findByProps({ type: "checkbox" })
        .props.onChange({ target: { checked: true } }),
    );
    await submit();
    expect(mocks.save).toHaveBeenCalledWith({
      preferredLevel: "subprofessional",
    });
    expect(mocks.replace).toHaveBeenCalledWith("/dashboard");
  });
  it("clears dates explicitly and keeps dirty inputs across query refreshes", async () => {
    await renderForm(true, {
      preferredLevel: "professional",
      targetExamDate: "2099-01-01",
    });
    await act(async () =>
      view.root
        .findByProps({ type: "date" })
        .props.onChange({ target: { value: "" } }),
    );
    await act(async () =>
      view.update(
        <PreparationForm
          editing
          initialPreferences={{
            preferredLevel: "subprofessional",
            targetExamDate: "2099-02-01",
          }}
        />,
      ),
    );
    await submit();
    expect(mocks.save).toHaveBeenCalledWith({
      preferredLevel: "professional",
      targetExamDate: null,
    });
  });
  it("keeps values after failure and permits a retry without changing destinations early", async () => {
    mocks.save.mockRejectedValueOnce(new Error("provider error"));
    await renderForm();
    await choose();
    await reviewSetup();
    await submit();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(JSON.stringify(view.toJSON())).toContain(
      "Your preferences could not be saved",
    );
    await submit();
    expect(mocks.replace).toHaveBeenCalledWith("/diagnostic");
  });
  it("rejects a past date without making a mutation", async () => {
    await renderForm();
    await choose();
    await submit();
    await act(async () =>
      view.root
        .findByProps({ type: "date" })
        .props.onChange({ target: { value: "2000-01-01" } }),
    );
    await submit();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("blocks duplicate submissions while the first save is pending", async () => {
    let finish!: () => void;
    mocks.save.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    await renderForm();
    await choose();
    await reviewSetup();
    let pending!: Promise<void>;
    await act(async () => {
      pending = view.root
        .findByType("form")
        .props.onSubmit({ preventDefault() {} });
    });
    await act(async () => {
      void view.root.findByType("form").props.onSubmit({ preventDefault() {} });
    });
    expect(mocks.save).toHaveBeenCalledOnce();
    await act(async () => {
      finish();
      await pending;
    });
  });
  it("shows one decision per step and retains draft values when going back", async () => {
    await renderForm();
    expect(view.root.findAllByProps({ type: "date" })).toHaveLength(0);
    expect(view.root.findAllByProps({ "aria-current": "step" })).toHaveLength(
      1,
    );
    await choose("subprofessional");
    await submit();
    expect(view.root.findAllByProps({ type: "radio" })).toHaveLength(0);
    await act(async () =>
      view.root
        .findByProps({ type: "date" })
        .props.onChange({ target: { value: "2099-12-01" } }),
    );
    await submit();
    expect(view.root.findAllByType("input")).toHaveLength(0);
    expect(JSON.stringify(view.toJSON())).toContain("2099-12-01");
    await clickButton("Change exam level");
    expect(
      view.root.findByProps({ value: "subprofessional" }).props.checked,
    ).toBe(true);
    await submit();
    expect(view.root.findByProps({ type: "date" }).props.value).toBe(
      "2099-12-01",
    );
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("skips an optional date without saving until final confirmation", async () => {
    await renderForm();
    await choose();
    await submit();
    await act(async () =>
      view.root
        .findByProps({ type: "date" })
        .props.onChange({ target: { value: "2000-01-01" } }),
    );
    await clickButton("Skip for now");
    expect(JSON.stringify(view.toJSON())).toContain("No target date for now");
    expect(mocks.save).not.toHaveBeenCalled();
    await submit();
    expect(mocks.save).toHaveBeenCalledWith({ preferredLevel: "professional" });
  });
  it("returns server date errors to the date step without discarding the draft", async () => {
    await renderForm();
    await choose();
    await submit();
    await act(async () =>
      view.root
        .findByProps({ type: "date" })
        .props.onChange({ target: { value: "2099-12-01" } }),
    );
    await submit();
    mocks.save.mockRejectedValueOnce(
      new ConvexError({ code: "INVALID_TARGET_DATE" }),
    );
    await submit();
    expect(view.root.findByProps({ type: "date" }).props.value).toBe(
      "2099-12-01",
    );
    expect(JSON.stringify(view.toJSON())).toContain("Choose a valid date");
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});

describe("reactive preparation routing", () => {
  it("replaces a failed preference read with the suspension notice without a retry or redirect", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.queryError = true;
    const tree = () => (
      <ApplicationAccessBoundary expectedUserId={"profile-a" as Id<"users">}>
        <PreparationContent
          kind="dashboard"
          initialPreferences={{
            preferredLevel: "professional",
            targetExamDate: null,
          }}
        />
      </ApplicationAccessBoundary>
    );
    try {
      await act(async () => {
        view = create(tree());
      });
      expect(JSON.stringify(view.toJSON())).not.toContain("account-status");
      expect(JSON.stringify(view.toJSON()).toLowerCase()).not.toContain(
        "suspended",
      );
      mocks.access = { status: "suspended" };
      await act(async () => view.update(tree()));
      expect(JSON.stringify(view.toJSON()).toLowerCase()).toContain(
        "suspended",
      );
      expect(mocks.replace).not.toHaveBeenCalled();
      expect(mocks.refresh).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
  it("hides unresolved preferences and redirects lost onboarding without rendering a summary", async () => {
    mocks.preferences = undefined;
    await act(async () => {
      view = create(
        <PreparationContent
          kind="dashboard"
          initialPreferences={{
            preferredLevel: "professional",
            targetExamDate: null,
          }}
        />,
      );
    });
    expect(JSON.stringify(view.toJSON())).not.toContain("account-status");
    mocks.preferences = initial;
    await act(async () =>
      view.update(
        <PreparationContent kind="dashboard" initialPreferences={initial} />,
      ),
    );
    expect(mocks.replace).toHaveBeenCalledWith("/onboarding");
    expect(JSON.stringify(view.toJSON())).not.toContain("account-status");
  });
  it("updates the level reactively but never presents a working diagnostic Start action", async () => {
    mocks.preferences = {
      preferredLevel: "professional",
      targetExamDate: null,
    };
    await act(async () => {
      view = create(
        <PreparationContent
          kind="diagnostic"
          initialPreferences={mocks.preferences!}
        />,
      );
    });
    expect(JSON.stringify(view.toJSON())).toContain("Professional");
    mocks.preferences = {
      preferredLevel: "subprofessional",
      targetExamDate: null,
    };
    await act(async () =>
      view.update(
        <PreparationContent kind="diagnostic" initialPreferences={initial} />,
      ),
    );
    expect(JSON.stringify(view.toJSON())).toContain("Subprofessional");
    expect(JSON.stringify(view.toJSON())).toContain(
      "assessment is not available yet",
    );
    expect(
      view.root.findAllByType("button").map((button) => button.props.children),
    ).not.toContain("Start");
  });
});
