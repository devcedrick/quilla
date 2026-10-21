type ClerkConfiguration = {
  publishableKey: string | undefined;
  secretKey: string | undefined;
};

/** Errors name the invalid variable and never interpolate its value. */
export function validateClerkConfiguration(configuration: ClerkConfiguration) {
  if (
    !/^pk_(test|live)_[A-Za-z0-9+/=_-]+$/.test(
      configuration.publishableKey ?? "",
    )
  ) {
    throw new Error("Missing or invalid NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  }
  const encodedHost = configuration.publishableKey!.replace(
    /^pk_(test|live)_/,
    "",
  );
  const decodedHost = Buffer.from(encodedHost, "base64").toString("utf8");
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]\$$/i.test(decodedHost)) {
    throw new Error("Missing or invalid NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  }
  if (!/^sk_(test|live)_[A-Za-z0-9_-]+$/.test(configuration.secretKey ?? "")) {
    throw new Error("Missing or invalid CLERK_SECRET_KEY");
  }
  const keyEnvironment = configuration.publishableKey!.split("_")[1];
  if (configuration.secretKey!.split("_")[1] !== keyEnvironment) {
    throw new Error(
      "CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY environments must match",
    );
  }
  // Deliberately do not return the secret: callers only need the public configuration.
  return { publishableKey: configuration.publishableKey! };
}
