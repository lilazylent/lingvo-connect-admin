"use client";
import { AuthGate } from "@/components/auth-provider";
import { CrmSettings } from "@/components/crm-settings";
export default function Page(){return <AuthGate permission="SETTINGS_MANAGE"><CrmSettings/></AuthGate>}
