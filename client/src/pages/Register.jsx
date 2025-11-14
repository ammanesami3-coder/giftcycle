import React, { useState } from "react";
import { registerUser } from "../services/api";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await registerUser({ name, email, password });
      setMsg("Registration successful! You can now log in.");
    } catch (err) {
      setMsg("Registration failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <form onSubmit={handleSubmit} className="bg-white shadow-lg p-6 rounded-lg w-full max-w-md space-y-4">
        <h2 className="text-2xl font-bold text-center">Create an Account</h2>

        {msg && <p className="text-center text-blue-600">{msg}</p>}

        <input type="text" placeholder="Full Name" className="w-full border p-2 rounded"
          value={name} onChange={(e) => setName(e.target.value)} required />

        <input type="email" placeholder="Email" className="w-full border p-2 rounded"
          value={email} onChange={(e) => setEmail(e.target.value)} required />

        <input type="password" placeholder="Password" className="w-full border p-2 rounded"
          value={password} onChange={(e) => setPassword(e.target.value)} required />

        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded">
          Register
        </button>
      </form>
    </div>
  );
};

export default Register;
