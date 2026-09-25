import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { LlmService } from '../src/llm/llm.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/test-app.js';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const ORG_A_KEY = 'e2e_org_a_key';
const ORG_B_KEY = 'e2e_org_b_key';

const CLASSIFIED_CATEGORY = 'billing';
const CLASSIFIED_REPLY = 'Halo Budi, kami sudah cek tagihan Anda dan akan menindaklanjuti.';

/**
 * These specs talk to a real PostgreSQL database and delete their own fixtures,
 * so they only run when TEST_DATABASE_URL is explicitly provided.
 */
describe.skipIf(!TEST_DATABASE_URL)('Tickets (e2e, requires TEST_DATABASE_URL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizationAId: number;
  let ticketId: number;

  async function removeFixtures(): Promise<void> {
    await prisma.ticket.deleteMany({
      where: { organization: { is: { apiKey: { in: [ORG_A_KEY, ORG_B_KEY] } } } },
    });
  }

  async function createTicket(apiKey: string, body: Record<string, unknown> = {}): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/tickets')
      .set('x-api-key', apiKey)
      .send({
        customer_email: 'budi@example.com',
        subject: 'Invoice saya salah',
        message: 'Mohon dicek tagihan bulan ini',
        ...body,
      })
      .expect(201);
  }

  beforeAll(async () => {
    app = await createTestApp({
      useRealPrisma: true,
      // The LLM is always stubbed: e2e tests must never depend on a provider.
      configure: (builder) =>
        builder.overrideProvider(LlmService).useValue({
          classifyTicket: async () => ({
            category: CLASSIFIED_CATEGORY,
            suggestedReply: CLASSIFIED_REPLY,
          }),
        }),
    });

    prisma = app.get(PrismaService);

    const organizationA = await prisma.organization.upsert({
      where: { apiKey: ORG_A_KEY },
      update: {},
      create: { name: 'E2E Organization A', apiKey: ORG_A_KEY },
    });
    await prisma.organization.upsert({
      where: { apiKey: ORG_B_KEY },
      update: {},
      create: { name: 'E2E Organization B', apiKey: ORG_B_KEY },
    });
    organizationAId = organizationA.id;

    await removeFixtures();
    ticketId = (await createTicket(ORG_A_KEY)).body.data.id;
  });

  afterAll(async () => {
    if (!app) {
      return;
    }

    await removeFixtures();
    await app.close();
  });

  it('classifies and drafts a reply for a new ticket', async () => {
    const response = await createTicket(ORG_A_KEY, {
      customer_email: 'siti@example.com',
      subject: 'Refund pesanan',
      message: 'Saya ingin mengajukan refund',
    });

    expect(response.body).toMatchObject({
      success: true,
      error: null,
      data: {
        customer_email: 'siti@example.com',
        category: CLASSIFIED_CATEGORY,
        suggested_reply: CLASSIFIED_REPLY,
        status: 'open',
      },
    });
    expect(response.body.data.organization_id).toBe(organizationAId);
    expect(Date.parse(response.body.data.created_at)).not.toBeNaN();
  });

  it('returns a ticket detail including the classification', async () => {
    const response = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('x-api-key', ORG_A_KEY)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: ticketId,
        category: CLASSIFIED_CATEGORY,
        suggested_reply: CLASSIFIED_REPLY,
      },
    });
  });

  it('lists no tickets for an organization that owns none', async () => {
    const response = await request(app.getHttpServer())
      .get('/tickets')
      .set('x-api-key', ORG_B_KEY)
      .expect(200);

    expect(response.body.data).toEqual([]);
  });

  it('filters the list by status', async () => {
    const open = await request(app.getHttpServer())
      .get('/tickets?status=open')
      .set('x-api-key', ORG_A_KEY)
      .expect(200);

    expect(open.body.data.length).toBeGreaterThan(0);

    const closed = await request(app.getHttpServer())
      .get('/tickets?status=closed')
      .set('x-api-key', ORG_A_KEY)
      .expect(200);

    expect(closed.body.data).toEqual([]);
  });

  it('filters the list by category', async () => {
    const response = await request(app.getHttpServer())
      .get(`/tickets?category=${CLASSIFIED_CATEGORY}`)
      .set('x-api-key', ORG_A_KEY)
      .expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
  });

  it('rejects an unknown filter value', async () => {
    await request(app.getHttpServer())
      .get('/tickets?status=archived')
      .set('x-api-key', ORG_A_KEY)
      .expect(400);
  });

  it('updates the status of a ticket', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}/status`)
      .set('x-api-key', ORG_A_KEY)
      .send({ status: 'in_progress' })
      .expect(200);

    expect(response.body.data.status).toBe('in_progress');
  });

  it('does not disclose a ticket owned by another organization', async () => {
    await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('x-api-key', ORG_B_KEY)
      .expect(404);
  });

  it('does not let another organization change the status', async () => {
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}/status`)
      .set('x-api-key', ORG_B_KEY)
      .send({ status: 'closed' })
      .expect(404);

    const stillOwnedByA = await request(app.getHttpServer())
      .get(`/tickets/${ticketId}`)
      .set('x-api-key', ORG_A_KEY)
      .expect(200);

    expect(stillOwnedByA.body.data.status).toBe('in_progress');
  });

  it('rejects an invalid status value', async () => {
    await request(app.getHttpServer())
      .patch(`/tickets/${ticketId}/status`)
      .set('x-api-key', ORG_A_KEY)
      .send({ status: 'archived' })
      .expect(400);
  });

  it('rejects a non numeric ticket id before reaching the database', async () => {
    await request(app.getHttpServer())
      .get('/tickets/not-a-number')
      .set('x-api-key', ORG_A_KEY)
      .expect(400);
  });

  it('rejects an invalid customer email', async () => {
    await request(app.getHttpServer())
      .post('/tickets')
      .set('x-api-key', ORG_A_KEY)
      .send({ customer_email: 'not-an-email', subject: 's', message: 'm' })
      .expect(400);
  });

  it('rejects camelCase payloads so the snake_case contract is enforced', async () => {
    await request(app.getHttpServer())
      .post('/tickets')
      .set('x-api-key', ORG_A_KEY)
      .send({ customerEmail: 'a@b.com', subject: 's', message: 'm' })
      .expect(400);
  });
});
