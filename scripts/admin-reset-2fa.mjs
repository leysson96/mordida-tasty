import { PrismaClient, Role } from '@prisma/client';
import { loadProjectEnv } from './load-env.mjs';

loadProjectEnv();

const email = readArg('--email') ?? process.env.MORDIDA_SEED_ADMIN_EMAIL;

if (!email) {
  console.error('Usage: npm run admin:reset-2fa -- --email=admin@example.com');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() }
  });

  if (!user) {
    throw new Error(`Admin not found: ${email}`);
  }

  if (user.role !== Role.ADMIN) {
    throw new Error(`User is not an admin: ${email}`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null
    }
  });

  console.log(`2FA reset for ${user.email}. Login again and activate 2FA from /admin/2fa.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

function readArg(name) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}
