'use strict';

const { randomUUID } = require('crypto');
const { QueryTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const now = new Date();

    const [admin] = await sequelize.query(
      `SELECT id FROM users WHERE email = 'admin@hire3d.com' LIMIT 1`,
      { type: QueryTypes.SELECT },
    );
    if (!admin) return;

    const clients = [
      {
        id: randomUUID(),
        company_name: 'Acme Corp',
        primary_contact_name: 'John Smith',
        primary_contact_email: 'john@acme.com',
        primary_contact_phone: '+441234567890',
        sector: 'Technology',
        headcount_at_engagement: 120,
        current_headcount: 135,
        business_stage: 'GROWTH',
        region: 'LONDON',
        assigned_operator_id: admin.id,
        status: 'ACTIVE',
        meta: '{}',
        created_at: now, updated_at: now,
      },
      {
        id: randomUUID(),
        company_name: 'Bright Solutions Ltd',
        primary_contact_name: 'Sarah Jones',
        primary_contact_email: 'sarah@brightsolutions.co.uk',
        primary_contact_phone: '+447911123456',
        sector: 'Finance',
        headcount_at_engagement: 45,
        current_headcount: 50,
        business_stage: 'ESTABLISHED',
        region: 'NORTH_WEST',
        assigned_operator_id: admin.id,
        status: 'AUDIT_IN_PROGRESS',
        meta: '{}',
        created_at: now, updated_at: now,
      },
      {
        id: randomUUID(),
        company_name: 'Green Leaf Organics',
        primary_contact_name: 'Emily Clarke',
        primary_contact_email: 'emily@greenleaf.com',
        sector: 'Retail',
        headcount_at_engagement: 18,
        business_stage: 'EARLY',
        region: 'SOUTH_WEST',
        assigned_operator_id: admin.id,
        status: 'FOLLOW_UP_DUE',
        meta: '{}',
        created_at: now, updated_at: now,
      },
    ];

    await queryInterface.bulkInsert('clients', clients, { ignoreDuplicates: true });

    // Add engagements for first two clients
    const engagements = [
      {
        id: randomUUID(),
        client_id: clients[0].id,
        product: 'HIRE_3D_CORE',
        engagement_date: '2025-01-15',
        fee_charged: 4500.00,
        fee_status: 'PAID',
        audit_date: '2025-02-10',
        audit_status: 'PHASE_1_COMPLETE',
        engagement_letter_signed_at: '2025-01-14',
        invoice_raised_at: '2025-01-15',
        meta: '{}',
        created_at: now, updated_at: now,
      },
      {
        id: randomUUID(),
        client_id: clients[1].id,
        product: 'THE_CHECK',
        engagement_date: '2025-03-01',
        fee_charged: 1800.00,
        fee_status: 'INVOICED',
        audit_status: 'SCHEDULED',
        engagement_letter_signed_at: '2025-02-28',
        invoice_raised_at: '2025-03-01',
        meta: '{}',
        created_at: now, updated_at: now,
      },
    ];

    await queryInterface.bulkInsert('engagements', engagements, { ignoreDuplicates: true });

    console.log(`Seeded ${clients.length} clients and ${engagements.length} engagements.`);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('engagements', null, {});
    await queryInterface.bulkDelete('clients', null, {});
  },
};
