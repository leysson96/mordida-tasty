import { PasswordResetClient } from '../../../components/password-reset-client';

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <PasswordResetClient token={token ?? ''} />;
}
