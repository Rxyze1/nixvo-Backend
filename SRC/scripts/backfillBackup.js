// scripts/backfillBackup.js
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// .env is at project root — go up 2 levels from SRC/scripts/
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ✅ Dynamic imports AFTER dotenv runs (fixes ESM hoisting issue)
const mongoose                        = (await import('mongoose')).default;
const { default: connectDb }          = await import('../Utils/DB.js');
const { default: backupConnection }   = await import('../Config/backupDb.js');
const { backupDocument }              = await import('../Service/Backup-DB/backupService.js');

// ─── Model Imports ───────────────────────────────────────────
const { default: User }                = await import('../Models/USER-Auth/User-Auth.-Model.js');
const { default: Client }              = await import('../Models/USER-Auth/Client-Model.js');
const { default: Official }            = await import('../Models/USER-Auth/Official-Model.js');
const { default: Employee }            = await import('../Models/USER-Auth/Employee-Model.js');
const { default: OTP }                 = await import('../Models/otpModel.js');
const { default: Job }                 = await import('../Models/USER-Auth/Client/Job.js');
const { default: Portfolio }           = await import('../Models/USER-Auth/Employee/PortfolioModel.js');
const { default: EmployeeApplication } = await import('../Models/USER-Auth/Employee/ApplicationModel.js');
const { default: ClientApplication }   = await import('../Models/USER-Auth/Client/Application.js');
const { default: Subscription }        = await import('../Models/Subscription/Subscription.Model.js');
const { default: Transaction }         = await import('../Models/Subscription/TransactionModel.js');
const { default: Wallet }              = await import('../Models/Subscription/WalletModel.js');
const { default: Notification }        = await import('../Models/Notification-Model/Notification.js');
const { default: ChatNotification }    = await import('../Models/Chat/ChatNotificationModel.js');
const { default: Conversation }        = await import('../Models/Chat/ConversationModel.js');
const { default: Message }             = await import('../Models/Chat/MessageModel.js');
const { default: Call }                = await import('../Models/Call/CallModel.js');

// ─── Collections ─────────────────────────────────────────────
const collections = [
  { Model: User,                name: 'users'                 },
  { Model: Client,              name: 'clients'               },
  { Model: Official,            name: 'officials'             },
  { Model: Employee,            name: 'employees'             },
  { Model: OTP,                 name: 'otps'                  },
  { Model: Job,                 name: 'jobs'                  },
  { Model: Portfolio,           name: 'portfolios'            },
  { Model: EmployeeApplication, name: 'employee_applications' },
  { Model: ClientApplication,   name: 'client_applications'  },
  { Model: Subscription,        name: 'subscriptions'         },
  { Model: Transaction,         name: 'transactions'          },
  { Model: Wallet,              name: 'wallets'               },
  { Model: Notification,        name: 'notifications'         },
  { Model: ChatNotification,    name: 'chat_notifications'    },
  { Model: Conversation,        name: 'conversations'         },
  { Model: Message,             name: 'messages'              },
  { Model: Call,                name: 'calls'                 },
];

// ─── Batch Size ───────────────────────────────────────────────
const BATCH_SIZE = 100;

// ─── Backfill Single Collection ───────────────────────────────
const backfillCollection = async ({ Model, name }) => {
  let skip  = 0;
  let total = 0;

  console.log(`\n📦 Processing [${name}]...`);

  while (true) {
    const docs = await Model.find({}).skip(skip).limit(BATCH_SIZE).lean();
    if (docs.length === 0) break;

    for (const doc of docs) {
      await backupDocument(name, 'create', doc);
    }

    total += docs.length;
    skip  += BATCH_SIZE;
    console.log(`   ↳ ${total} documents backed up...`);

    if (docs.length < BATCH_SIZE) break;
  }

  console.log(`✅ [${name}] Done — ${total} documents`);
  return total;
};

// ─── Main ─────────────────────────────────────────────────────
const backfill = async () => {
  await connectDb();
  console.log('🔄 Backfill started...');

  const summary  = [];
  let grandTotal = 0;

  for (const collection of collections) {
    const count = await backfillCollection(collection);
    summary.push({ name: collection.name, count });
    grandTotal += count;
  }

  // ── Summary ──
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║              BACKFILL SUMMARY                ║');
  console.log('╠══════════════════════════════════════════════╣');
  for (const { name, count } of summary) {
    console.log(`║  ${name.padEnd(28)} ${String(count).padStart(6)} docs  ║`);
  }
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  ${'TOTAL'.padEnd(28)} ${String(grandTotal).padStart(6)} docs  ║`);
  console.log('╚══════════════════════════════════════════════╝\n');

  await mongoose.connection.close();
  await backupConnection.close();
  console.log('🎉 All done. Connections closed.');
  process.exit(0);
};

backfill().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});