"use client";
import { Container } from "../components/ContainerComponent";
import { Card } from "../components/CardComponent";
import { Button } from "../components/ButtonComponent";

import { useState } from "react";
import { supabase } from "../../app/lib/supabase";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Invalid credentials");
    } else {
      router.push("/admin/candidates");
    }
  };

    return (
    <Container>
      <div className="flex justify-center items-center min-h-[70vh]">
        <Card>
          <h1 className="text-2xl font-bold mb-6">
            CSM Login
          </h1>

          <input
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mb-4 p-3 rounded border border-border dark:border-border-dark bg-transparent"
          />

          <input
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mb-6 p-3 rounded border border-border dark:border-border-dark bg-transparent"
          />

          <Button onClick={handleLogin}>
            Login
          </Button>
        </Card>
      </div>
    </Container>
  );

}