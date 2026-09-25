import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/test-app.js';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('serves GET / without an API key', async () => {
    await request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });

  it('rejects GET /tickets when the x-api-key header is missing', async () => {
    await request(app.getHttpServer()).get('/tickets').expect(401);
  });

  it('rejects GET /tickets when the API key matches no organization', async () => {
    await request(app.getHttpServer())
      .get('/tickets')
      .set('x-api-key', 'not-a-real-key')
      .expect(401);
  });

  it('rejects PATCH /tickets/:id/status without an API key', async () => {
    await request(app.getHttpServer())
      .patch('/tickets/1/status')
      .send({ status: 'closed' })
      .expect(401);
  });
});
