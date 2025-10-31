import { storage } from "./storage.js";
import path from "path";
import bcrypt from "bcryptjs";

export async function seedAdminUser() {
  const useDevDefaults = process.env.USE_DEV_DEFAULTS === "true";
  
  let adminEmail = process.env.ADMIN_EMAIL;
  let adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminEmail || !adminPassword) {
    if (useDevDefaults) {
      adminEmail = "orangesign@gmail.com";
      adminPassword = "admin@123";
      console.warn("⚠️  Using default dev credentials. Set ADMIN_EMAIL and ADMIN_PASSWORD for production.");
    } else {
      console.error(
        "❌ ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.\n" +
        "For local development, set USE_DEV_DEFAULTS=true to use defaults.\n" +
        "For production, always set ADMIN_EMAIL and ADMIN_PASSWORD."
      );
      process.exit(1);
    }
  }
  
  const existingUser = await storage.getUserByUsername(adminEmail);
  if (!existingUser) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await storage.createUser({
      username: adminEmail,
      password: hashedPassword,
    });
    console.log(`✓ Created admin user: ${adminEmail}`);
  } else {
    console.log(`✓ Admin user already exists: ${adminEmail}`);
  }
}

export async function seedProjects() {
  const projects = [
    {
      title: "Premium LED Signage",
      description: "Modern illuminated LED business signboard with vibrant orange and white lighting for a commercial storefront.",
      imageUrl: "/uploads/LED_signage_project_example_0ea69b70.png",
    },
    {
      title: "Outdoor Billboard Campaign",
      description: "Large outdoor advertising billboard with vibrant full-color panaflex print for maximum brand visibility.",
      imageUrl: "/uploads/Outdoor_banner_project_example_66b5d8cf.png",
    },
    {
      title: "Storefront Branding",
      description: "Professional storefront signage installation with premium quality printed signs for modern retail shops.",
      imageUrl: "/uploads/Storefront_signage_project_example_3de86416.png",
    },
    {
      title: "Vibrant Panaflex Banner",
      description: "High-quality large-format vinyl banner printing with colorful graphics and professional finish.",
      imageUrl: "/uploads/Panaflex_printing_project_example_cd59fc4e.png",
    },
    {
      title: "LED Channel Letters",
      description: "Premium outdoor LED channel letter signage with warm illumination for impressive brand presence.",
      imageUrl: "/uploads/LED_channel_letters_project_2d6aab8b.png",
    },
    {
      title: "Event Display Backdrop",
      description: "Large format event banner display for professional trade shows with vibrant colors and high quality print.",
      imageUrl: "/uploads/Event_banner_project_example_73011517.png",
    },
    {
      title: "Large Format Installation",
      description: "Premium vinyl graphics for building wraps and vehicle branding with impressive scale and vibrant colors.",
      imageUrl: "/uploads/Large_format_wrap_project_8c93663c.png",
    },
  ];

  const existingProjects = await storage.getProjects();
  if (existingProjects.length === 0) {
    for (const project of projects) {
      await storage.createProject(project);
    }
    console.log(`Seeded ${projects.length} projects`);
  } else {
    console.log(`Skipping seed: ${existingProjects.length} projects already exist`);
  }
}
