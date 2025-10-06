import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { seedDatabase } from "./seed";
import { getDataSourceToken } from "@nestjs/typeorm";

async function runSeeder() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const dataSource = app.get(getDataSourceToken());
    await seedDatabase(dataSource);
    console.log("Seeding completed successfully");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runSeeder();
