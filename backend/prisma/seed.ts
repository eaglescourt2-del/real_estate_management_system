import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Real Estate System initial staff accounts and settings...');

  // Hash passwords using Argon2id
  const hashPassword = async (password: string) => {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  };

  const superAdminPass = await hashPassword('SuperAdminPassword2026!');
  const mdPass = await hashPassword('DirectorPassword2026!');
  const adminPass = await hashPassword('AdminPassword2026!');
  const agentPass = await hashPassword('AgentPassword2026!');

  // 1. Seed Super Administrator
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@realestatedev.gh' },
    update: {},
    create: {
      email: 'superadmin@realestatedev.gh',
      telephone: '+233244000001',
      firstName: 'Chief',
      lastName: 'Administrator',
      passwordHash: superAdminPass,
      role: UserRole.SUPER_ADMINISTRATOR,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`- Super Administrator seeded: ${superAdmin.email}`);

  // 2. Seed Managing Director
  const md = await prisma.user.upsert({
    where: { email: 'md@realestatedev.gh' },
    update: {},
    create: {
      email: 'md@realestatedev.gh',
      telephone: '+233244000002',
      firstName: 'Managing',
      lastName: 'Director',
      passwordHash: mdPass,
      role: UserRole.MANAGING_DIRECTOR,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`- Managing Director seeded: ${md.email}`);

  // 3. Seed Administrator
  const admin = await prisma.user.upsert({
    where: { email: 'admin@realestatedev.gh' },
    update: {},
    create: {
      email: 'admin@realestatedev.gh',
      telephone: '+233244000003',
      firstName: 'Operations',
      lastName: 'Administrator',
      passwordHash: adminPass,
      role: UserRole.ADMINISTRATOR,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`- Administrator seeded: ${admin.email}`);

  // 4. Seed Sales Agent
  const agent = await prisma.user.upsert({
    where: { email: 'agent.boateng@realestatedev.gh' },
    update: {},
    create: {
      email: 'agent.boateng@realestatedev.gh',
      telephone: '+233244000004',
      firstName: 'Samuel',
      lastName: 'Boateng',
      passwordHash: agentPass,
      role: UserRole.SALES_AGENT,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`- Sales Agent seeded: ${agent.email}`);

  // 5. Seed System Settings
  const settings = await prisma.systemSetting.upsert({
    where: { id: 'SYSTEM_CONFIG' },
    update: {},
    create: {
      id: 'SYSTEM_CONFIG',
      companyName: 'Ghana Real Estate Developers',
      companyTagline: 'Securing Your Land & Future with Trust',
      companyEmail: 'info@realestatedev.gh',
      companyPhone: '+233 30 200 0000',
      companyAddress: 'Airport Residential Area, Accra, Ghana',
      defaultCurrency: 'GHS',
      currencySymbol: 'GH₵',
      emailFromAddress: 'receipts@realestatedev.gh',
    },
  });
  console.log(`- System settings seeded with currency ${settings.defaultCurrency} (${settings.currencySymbol})`);

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

