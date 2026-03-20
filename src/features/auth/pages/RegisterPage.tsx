"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Button from "@/shared/components/Button";
import Input from "@/shared/components/Input";
import Select from "@/shared/components/Select";
import { register, sendOtp, verifyOtp } from "@/features/auth/api";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext"; // Import useAuth
import Image from "next/image";

const indianStates = [
  { value: "ANDHRA_PRADESH", label: "Andhra Pradesh" },
  { value: "ARUNACHAL_PRADESH", label: "Arunachal Pradesh" },
  { value: "ASSAM", label: "Assam" },
  { value: "BIHAR", label: "Bihar" },
  { value: "CHHATTISGARH", label: "Chhattisgarh" },
  { value: "GOA", label: "Goa" },
  { value: "GUJARAT", label: "Gujarat" },
  { value: "HARYANA", label: "Haryana" },
  { value: "HIMACHAL_PRADESH", label: "Himachal Pradesh" },
  { value: "JHARKHAND", label: "Jharkhand" },
  { value: "KARNATAKA", label: "Karnataka" },
  { value: "KERALA", label: "Kerala" },
  { value: "MADHYA_PRADESH", label: "Madhya Pradesh" },
  { value: "MAHARASHTRA", label: "Maharashtra" },
  { value: "MANIPUR", label: "Manipur" },
  { value: "MEGHALAYA", label: "Meghalaya" },
  { value: "MIZORAM", label: "Mizoram" },
  { value: "NAGALAND", label: "Nagaland" },
  { value: "ODISHA", label: "Odisha" },
  { value: "PUNJAB", label: "Punjab" },
  { value: "RAJASTHAN", label: "Rajasthan" },
  { value: "SIKKIM", label: "Sikkim" },
  { value: "TAMIL_NADU", label: "Tamil Nadu" },
  { value: "TELANGANA", label: "Telangana" },
  { value: "TRIPURA", label: "Tripura" },
  { value: "UTTAR_PRADESH", label: "Uttar Pradesh" },
  { value: "UTTARAKHAND", label: "Uttarakhand" },
  { value: "WEST_BENGAL", label: "West Bengal" },
  { value: "DELHI", label: "Delhi" },
];

const roleOptions = [
  { value: "BUYER", label: "Buyer" },
  { value: "AGENT", label: "Agent" },
  { value: "SUPPLIER", label: "Supplier" },
  { value: "CUSTOMER", label: "Customer" },
  { value: "TRANSPORTER", label: "Transporter" },
];

const RegisterPage = () => {
  const searchParams = useSearchParams();
  const { login } = useAuth(); // Get login function
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"FORM" | "OTP">("FORM");
  const [otp, setOtp] = useState("");

  const initialMobile = searchParams.get('mobile') || "";

  const [formData, setFormData] = useState({
    name: "",
    mobileNumber: initialMobile,
    state: "",
    identity: "",
  });

  useEffect(() => {
    if (initialMobile) {
      setFormData(prev => ({ ...prev, mobileNumber: initialMobile }));
    }
  }, [initialMobile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { name, mobileNumber, state, identity } = formData;

    try {
      if (step === "FORM") {
        if (!name || !mobileNumber || !state || !identity) {
          toast.error("Please fill all fields");
          setIsLoading(false);
          return;
        }

        await sendOtp({ mobileNumber });
        setStep("OTP");
        toast.success("OTP sent. Please verify to complete signup.");
        setIsLoading(false);
        return;
      }

      if (!otp || otp.length !== 6) {
        toast.error("Enter a valid 6-digit OTP");
        setIsLoading(false);
        return;
      }

      await verifyOtp({ mobileNumber, otp });

      const response = await register({
        name,
        mobileNumber,
        state,
        identity: identity as "BUYER" | "AGENT" | "SUPPLIER" | "CUSTOMER" | "TRANSPORTER",
      });

      if (response.accessToken) {
        await login(response.accessToken, response.user);
        toast.success("Account created successfully!");
      }

    } catch (error: any) {
      toast.error(error.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-300 flex flex-col relative overflow-hidden">
      <div className="w-full relative bg-gray-200 pb-8">
        <Image
          src="/images/truck-img.png"
          alt="MandiPlus Truck"
          width={1200}
          height={800}
          className="w-full h-auto block"
          priority
        />
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/5 to-transparent" />
      </div>

      <div className="flex-1 bg-white -mt-8 px-6 py-8 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] relative z-10 flex flex-col">
        <h2 className="text-2xl font-bold mb-1 text-gray-800" style={{ fontFamily: "Poppins, sans-serif" }}>
          Welcome to <span className="text-[#4309ac]">MandiPlus</span>
        </h2>
        <p className="text-gray-800 mb-6">Complete your profile</p>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col">
          {step === "FORM" ? (
            <>
              <Input
                className="bg-gray-100/80"
                placeholder="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              <Input
                className={`bg-gray-100/80 ${initialMobile ? "opacity-70" : ""}`}
                placeholder="Mobile Number"
                maxLength={10}
                value={formData.mobileNumber}
                onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                readOnly={!!initialMobile}
              />

              <Select
                className="bg-gray-200/80"
                placeholder="Select State"
                options={indianStates}
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />

              <Select
                className="bg-gray-200/80"
                placeholder="Select Role"
                options={roleOptions}
                value={formData.identity}
                onChange={(e) => setFormData({ ...formData, identity: e.target.value })}
              />
            </>
          ) : (
            <>
              <p className="text-center text-sm text-gray-700">
                OTP sent to {formData.mobileNumber}
              </p>
              <Input
                className="bg-gray-100/80 text-center tracking-widest"
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </>
          )}

          <div className="pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 rounded-xl text-white ${isLoading ? "bg-gray-400" : "bg-[#4309ac]"}`}
            >
              {isLoading ? "Processing..." : step === "FORM" ? "Sign Up" : "Verify & Sign Up"}
            </Button>
          </div>
        </form>

        <p className="pt-6 text-center text-sm text-gray-700">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-[#4309ac]">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
