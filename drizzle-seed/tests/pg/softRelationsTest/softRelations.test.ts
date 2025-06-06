import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { reset, seed } from '../../../src/index.ts';
import * as schema from './pgSchema.ts';

let client: PGlite;
let db: PgliteDatabase;

beforeAll(async () => {
	client = new PGlite();

	db = drizzle(client);

	await db.execute(sql`CREATE SCHEMA "seeder_lib_pg";`);
	await db.execute(
		sql`
			    CREATE TABLE IF NOT EXISTS "seeder_lib_pg"."customer" (
				"id" varchar(256) PRIMARY KEY NOT NULL,
				"company_name" text NOT NULL,
				"contact_name" text NOT NULL,
				"contact_title" text NOT NULL,
				"address" text NOT NULL,
				"city" text NOT NULL,
				"postal_code" text,
				"region" text,
				"country" text NOT NULL,
				"phone" text NOT NULL,
				"fax" text
			);
		`,
	);

	await db.execute(
		sql`
			    CREATE TABLE IF NOT EXISTS "seeder_lib_pg"."order_detail" (
				"unit_price" numeric NOT NULL,
				"quantity" integer NOT NULL,
				"discount" numeric NOT NULL,
				"order_id" integer NOT NULL,
				"product_id" integer NOT NULL
			);
		`,
	);

	await db.execute(
		sql`
			    CREATE TABLE IF NOT EXISTS "seeder_lib_pg"."employee" (
				"id" integer PRIMARY KEY NOT NULL,
				"last_name" text NOT NULL,
				"first_name" text,
				"title" text NOT NULL,
				"title_of_courtesy" text NOT NULL,
				"birth_date" timestamp NOT NULL,
				"hire_date" timestamp NOT NULL,
				"address" text NOT NULL,
				"city" text NOT NULL,
				"postal_code" text NOT NULL,
				"country" text NOT NULL,
				"home_phone" text NOT NULL,
				"extension" integer NOT NULL,
				"notes" text NOT NULL,
				"reports_to" integer,
				"photo_path" text
			);
		`,
	);

	await db.execute(
		sql`
			    CREATE TABLE IF NOT EXISTS "seeder_lib_pg"."order" (
				"id" integer PRIMARY KEY NOT NULL,
				"order_date" timestamp NOT NULL,
				"required_date" timestamp NOT NULL,
				"shipped_date" timestamp,
				"ship_via" integer NOT NULL,
				"freight" numeric NOT NULL,
				"ship_name" text NOT NULL,
				"ship_city" text NOT NULL,
				"ship_region" text,
				"ship_postal_code" text,
				"ship_country" text NOT NULL,
				"customer_id" text NOT NULL,
				"employee_id" integer NOT NULL
			);    
		`,
	);

	await db.execute(
		sql`
			    CREATE TABLE IF NOT EXISTS "seeder_lib_pg"."product" (
				"id" integer PRIMARY KEY NOT NULL,
				"name" text NOT NULL,
				"quantity_per_unit" text NOT NULL,
				"unit_price" numeric NOT NULL,
				"units_in_stock" integer NOT NULL,
				"units_on_order" integer NOT NULL,
				"reorder_level" integer NOT NULL,
				"discontinued" integer NOT NULL,
				"supplier_id" integer NOT NULL
			);    
		`,
	);

	await db.execute(
		sql`
			    CREATE TABLE IF NOT EXISTS "seeder_lib_pg"."supplier" (
				"id" integer PRIMARY KEY NOT NULL,
				"company_name" text NOT NULL,
				"contact_name" text NOT NULL,
				"contact_title" text NOT NULL,
				"address" text NOT NULL,
				"city" text NOT NULL,
				"region" text,
				"postal_code" text NOT NULL,
				"country" text NOT NULL,
				"phone" text NOT NULL
			);    
		`,
	);
});

afterEach(async () => {
	await reset(db, schema);
});

afterAll(async () => {
	await client.close();
});

const checkSoftRelations = (
	customers: (typeof schema.customers.$inferSelect)[],
	details: (typeof schema.details.$inferSelect)[],
	employees: (typeof schema.employees.$inferSelect)[],
	orders: (typeof schema.orders.$inferSelect)[],
	products: (typeof schema.products.$inferSelect)[],
	suppliers: (typeof schema.suppliers.$inferSelect)[],
) => {
	// employees soft relations check
	const employeeIds = new Set(employees.map((employee) => employee.id));
	const employeesPredicate = employees.every((employee) =>
		employee.reportsTo !== null && employeeIds.has(employee.reportsTo)
	);
	expect(employeesPredicate).toBe(true);

	// orders soft relations check
	const customerIds = new Set(customers.map((customer) => customer.id));
	const ordersPredicate1 = orders.every((order) => order.customerId !== null && customerIds.has(order.customerId));
	expect(ordersPredicate1).toBe(true);

	const ordersPredicate2 = orders.every((order) => order.employeeId !== null && employeeIds.has(order.employeeId));
	expect(ordersPredicate2).toBe(true);

	// product soft relations check
	const supplierIds = new Set(suppliers.map((supplier) => supplier.id));
	const productsPredicate = products.every((product) =>
		product.supplierId !== null && supplierIds.has(product.supplierId)
	);
	expect(productsPredicate).toBe(true);

	// details soft relations check
	const orderIds = new Set(orders.map((order) => order.id));
	const detailsPredicate1 = details.every((detail) => detail.orderId !== null && orderIds.has(detail.orderId));
	expect(detailsPredicate1).toBe(true);

	const productIds = new Set(products.map((product) => product.id));
	const detailsPredicate2 = details.every((detail) => detail.productId !== null && productIds.has(detail.productId));
	expect(detailsPredicate2).toBe(true);
};

test('basic seed, soft relations test', async () => {
	await seed(db, schema);

	const customers = await db.select().from(schema.customers);
	const details = await db.select().from(schema.details);
	const employees = await db.select().from(schema.employees);
	const orders = await db.select().from(schema.orders);
	const products = await db.select().from(schema.products);
	const suppliers = await db.select().from(schema.suppliers);

	expect(customers.length).toBe(10);
	expect(details.length).toBe(10);
	expect(employees.length).toBe(10);
	expect(orders.length).toBe(10);
	expect(products.length).toBe(10);
	expect(suppliers.length).toBe(10);

	checkSoftRelations(customers, details, employees, orders, products, suppliers);
});

test("redefine(refine) orders count using 'with' in customers, soft relations test", async () => {
	await seed(db, schema, { count: 11 }).refine(() => ({
		customers: {
			count: 4,
			with: {
				orders: 2,
			},
		},
		orders: {
			count: 13,
		},
	}));

	const customers = await db.select().from(schema.customers);
	const details = await db.select().from(schema.details);
	const employees = await db.select().from(schema.employees);
	const orders = await db.select().from(schema.orders);
	const products = await db.select().from(schema.products);
	const suppliers = await db.select().from(schema.suppliers);

	expect(customers.length).toBe(4);
	expect(details.length).toBe(11);
	expect(employees.length).toBe(11);
	expect(orders.length).toBe(8);
	expect(products.length).toBe(11);
	expect(suppliers.length).toBe(11);

	checkSoftRelations(customers, details, employees, orders, products, suppliers);
});

test("sequential using of 'with', soft relations test", async () => {
	await seed(db, schema, { count: 11 }).refine(() => ({
		customers: {
			count: 4,
			with: {
				orders: 2,
			},
		},
		orders: {
			count: 12,
			with: {
				details: 3,
			},
		},
	}));

	const customers = await db.select().from(schema.customers);
	const details = await db.select().from(schema.details);
	const employees = await db.select().from(schema.employees);
	const orders = await db.select().from(schema.orders);
	const products = await db.select().from(schema.products);
	const suppliers = await db.select().from(schema.suppliers);

	expect(customers.length).toBe(4);
	expect(details.length).toBe(24);
	expect(employees.length).toBe(11);
	expect(orders.length).toBe(8);
	expect(products.length).toBe(11);
	expect(suppliers.length).toBe(11);

	checkSoftRelations(customers, details, employees, orders, products, suppliers);
});
