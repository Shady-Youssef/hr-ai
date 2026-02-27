"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    avatar_url: "",
  });

  const [originalProfile, setOriginalProfile] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    avatar_url: "",
  });

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const [toast, setToast] = useState(null);
  const [preview, setPreview] = useState(null);

  const previewRef = useRef(null);

  // ---------- Toast ----------
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // ---------- Password Strength ----------
  const getPasswordStrength = (password) => {
    if (!password) return { label: "", color: "" };
    if (password.length < 6) return { label: "Weak", color: "bg-red-500" };
    if (password.length < 10) return { label: "Medium", color: "bg-yellow-500" };
    return { label: "Strong", color: "bg-green-500" };
  };

  const strength = getPasswordStrength(passwordData.newPassword);

  const hasChanges =
    profile.first_name !== originalProfile.first_name ||
    profile.last_name !== originalProfile.last_name ||
    profile.phone !== originalProfile.phone ||
    profile.avatar_url !== originalProfile.avatar_url;

  // ---------- Load Profile ----------
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (data) {
          setProfile(data);
          setOriginalProfile(data);
        } else {
          // 🔥 Auto-create empty profile row if not exists
          const emptyProfile = {
            id: user.id,
            first_name: "",
            last_name: "",
            phone: "",
            avatar_url: "",
          };

          await supabase.from("profiles").insert(emptyProfile);

          setProfile(emptyProfile);
          setOriginalProfile(emptyProfile);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  // ---------- Update Profile ----------
  const updateProfile = async () => {
    if (!hasChanges) {
      showToast("success", "No changes detected.");
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        showToast("error", "User not authenticated.");
        return;
      }

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        ...profile,
        updated_at: new Date(),
      });

      if (error) {
        showToast("error", "Failed to update profile.");
      } else {
        setOriginalProfile(profile);
        window.dispatchEvent(new Event("profileUpdated"));
        showToast("success", "Profile updated successfully.");
      }
    } catch (err) {
      console.error(err);
      showToast("error", "Unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- Change Password ----------
  const handleChangePassword = async () => {
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      showToast("error", "Please fill in both password fields.");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast("error", "Passwords do not match.");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      showToast("error", "Password must be at least 6 characters.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: passwordData.newPassword,
    });

    if (error) {
      showToast("error", "Failed to update password.");
    } else {
      showToast("success", "Password updated successfully.");
      setPasswordData({ newPassword: "", confirmPassword: "" });
    }
  };

  // ---------- Upload Avatar ----------
  const uploadAvatar = async (e) => {
    try {
      setUploading(true);
      const file = e.target.files[0];
      if (!file) return;

      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
      }

      const objectUrl = URL.createObjectURL(file);
      previewRef.current = objectUrl;
      setPreview(objectUrl);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const filePath = `${user.id}/avatar.png`;

      await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setProfile({
        ...profile,
        avatar_url: data.publicUrl,
      });

      showToast("success", "Avatar updated.");
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to upload avatar.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <h1 className="text-3xl font-bold">Profile Settings</h1>

      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-xl shadow-lg text-white ${
            toast.type === "success"
              ? "bg-green-600"
              : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="bg-[#1f2937] p-6 rounded-2xl shadow-lg space-y-6">
        <div className="flex items-center gap-6 flex-wrap">
          <img
            src={
              preview ||
              profile.avatar_url ||
              "/default-avatar.png"
            }
            className="w-24 h-24 rounded-full object-cover border"
          />

          <label className="cursor-pointer bg-blue-600 px-4 py-2 rounded-lg text-white hover:bg-blue-500">
            {uploading ? "Uploading..." : "Change Avatar"}
            <input type="file" hidden onChange={uploadAvatar} />
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <input
            value={profile.first_name}
            onChange={(e) =>
              setProfile({
                ...profile,
                first_name: e.target.value,
              })
            }
            placeholder="First Name"
            className="p-3 rounded-lg bg-gray-800 border border-gray-700"
          />

          <input
            value={profile.last_name}
            onChange={(e) =>
              setProfile({
                ...profile,
                last_name: e.target.value,
              })
            }
            placeholder="Last Name"
            className="p-3 rounded-lg bg-gray-800 border border-gray-700"
          />

          <input
            value={profile.phone}
            onChange={(e) =>
              setProfile({
                ...profile,
                phone: e.target.value,
              })
            }
            placeholder="Phone Number"
            className="p-3 rounded-lg bg-gray-800 border border-gray-700 md:col-span-2"
          />
        </div>

        <button
          onClick={updateProfile}
          disabled={saving || !hasChanges}
          className={`px-6 py-3 rounded-lg text-white ${
            saving || !hasChanges
              ? "bg-green-600 opacity-50 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-500"
          }`}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}