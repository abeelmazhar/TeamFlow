import { env } from "../config/env.js";
import {
  addMember,
  createOrg,
  createProject,
  createTask,
  createUser,
} from "./factories.js";
import { pool } from "./pool.js";
import { withTransaction } from "./transaction.js";

if (env.NODE_ENV === "production") {
  console.error("❌ Refusing to seed a production database.");
  process.exit(1);
}

try {
  await withTransaction(async (db) => {
    // Wipe everything. CASCADE also clears every table that depends on these two.
    await db.query("TRUNCATE users, organizations CASCADE");

    // Users (.test is a reserved domain, so it can never be a real address)
    const ali = await createUser(db, "ali@acme.test", "Ali Khan");
    const sara = await createUser(db, "sara@acme.test", "Sara Ahmed");
    const bilal = await createUser(db, "bilal@acme.test", "Bilal Raza");
    const hina = await createUser(db, "hina@acme.test", "Hina Malik");
    const omar = await createUser(db, "omar@globex.test", "Omar Farooq");

    // Two companies, to test isolation
    const acme = await createOrg(db, "Acme");
    const globex = await createOrg(db, "Globex");

    await addMember(db, acme, ali, "owner");
    await addMember(db, acme, sara, "admin");
    await addMember(db, acme, bilal, "manager");
    await addMember(db, acme, hina, "member");
    await addMember(db, globex, omar, "owner");

    const website = await createProject(db, acme, "Website Redesign", bilal);
    const rocket = await createProject(db, globex, "Rocket Launch", omar);

    const homepage = await createTask(db, {
      orgId: acme, projectId: website, title: "Design new homepage",
      status: "in_progress", priority: "high", dueInDays: 3,
      assigneeId: hina, createdBy: bilal,
    });
    await createTask(db, {
      orgId: acme, projectId: website, title: "Fix broken contact form",
      status: "todo", priority: "urgent", dueInDays: -2, // overdue
      assigneeId: hina, createdBy: bilal,
    });
    await createTask(db, {
      orgId: acme, projectId: website, title: "Choose color palette",
      status: "done", priority: "medium", dueInDays: -5,
      assigneeId: bilal, createdBy: bilal,
    });
    await createTask(db, {
      orgId: globex, projectId: rocket, title: "Secret Globex task",
      status: "todo", priority: "low", dueInDays: null,
      assigneeId: omar, createdBy: omar,
    });

    await db.query(
      `INSERT INTO comments (organization_id, task_id, author_id, body)
       VALUES ($1, $2, $3, $4)`,
      [acme, homepage, bilal, "Please use the new brand colors."],
    );

    const mobile = await createProject(db, acme, "Mobile App", bilal);
    await createTask(db, {
      orgId: acme, projectId: mobile, title: "Sketch onboarding screens",
      status: "todo", priority: "medium", dueInDays: 7,
      assigneeId: null, createdBy: bilal,
    });
    await createTask(db, {
      orgId: acme, projectId: mobile, title: "Review login flow",
      status: "in_review", priority: "high", dueInDays: 2,
      assigneeId: sara, createdBy: bilal,
    });
    await db.query(
      `INSERT INTO comments (organization_id, task_id, author_id, body)
       VALUES ($1, $2, $3, $4)`,
      [acme, homepage, hina, "The hero image should work on small screens too."],
    );
  });

  console.log("✅ Seed complete");
} catch (err) {
  console.error("❌ Seed failed:", err);
  process.exitCode = 1;
} finally {
  await pool.end(); // close connections so the script can exit
}