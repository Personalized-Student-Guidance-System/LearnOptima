export function getOnboardingRedirect(user) {
  if (!user) return '/login';
  const step = user.onboardingStep ?? 1;
  const completed = user.onboardingCompleted ?? false;
  if (!completed && step >= 1 && step <= 5) return `/onboarding/step${step}`;
  return '/dashboard';
}
