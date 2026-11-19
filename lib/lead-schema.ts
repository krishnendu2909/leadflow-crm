import { z } from "zod";

export const leadSchema = z.object({
  enquiryId: z.string().trim().min(1, "Enquiry number is required").max(50, "Enquiry number must be 50 characters or fewer"),
  name: z.string().trim().min(2, "Customer name is required"),
  mobile: z.string().trim().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
  address: z.string().trim(),
  village: z.string().trim(),
  district: z.string().trim(),
  state: z.string().trim(),
  product: z.string().trim().min(1, "Product category is required"),
  subcategory: z.string().trim(),
  enquiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid enquiry date"),
  quotationGiven: z.enum(["Yes", "No"]),
  quotationAmount: z.number().min(0),
  dealStatus: z.enum(["Open", "Closed"]),
});

export type LeadInput = z.infer<typeof leadSchema>;
