
"use strict";

const cfg = window.AZAM_CONFIG;

if (!cfg || !window.supabase) {
  alert("AZAM সেটিংস লোড হয়নি। config.js পরীক্ষা করুন।");
  throw new Error("Supabase configuration missing");
}

const client = window.supabase.createClient(
  cfg.SUPABASE_URL,
  cfg.SUPABASE_ANON_KEY
);

const $ = id => document.getElementById(id);

let editingId = null;
let allEntries = [];
let idleTimer = null;
let isRecoveringPassword = false;

const IDLE_LIMIT = 15 * 60 * 1000;

function msg(text) {
  const vaultVisible = $("vaultBox") && !$("vaultBox").hidden;
  const target = vaultVisible
    ? ($("passwordMessage") || $("message"))
    : ($("message") || $("passwordMessage"));

  if (target) target.textContent = text;
}

function showVault(session) {
  $("loginBox").hidden = !!session;
  $("vaultBox").hidden = !session;
}

function resetIdleTimer() {
  clearTimeout(idleTimer);

  if (isRecoveringPassword) return;

  idleTimer = setTimeout(async () => {
    const { data } = await client.auth.getSession();

    if (data.session) {
      await client.auth.signOut();
      allEntries = [];
      showVault(null);
      msg("নিরাপত্তার জন্য আপনাকে স্বয়ংক্রিয়ভাবে লগআউট করা হয়েছে।");
    }
  }, IDLE_LIMIT);
}

function startSecurity() {
  resetIdleTimer();
}

function stopSecurity() {
  clearTimeout(idleTimer);
  idleTimer = null;
}

["click", "keydown", "touchstart", "scroll", "pointerdown"].forEach(event => {
  window.addEventListener(event, () => {
    const vault = $("vaultBox");

    if (vault && !vault.hidden) {
      resetIdleTimer();
    }
  }, { passive: true });
});

async function loadEntries() {
  const box = $("entries");
  box.textContent = "তথ্য লোড হচ্ছে...";

  const { data, error } = await client
    .from("vault_entries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    box.textContent = "তথ্য লোড করা যায়নি: " + error.message;
    return;
  }

  allEntries = data || [];
  renderEntries();
}

function renderEntries() {
  const box = $("entries");
  const query = $("search").value.trim().toLowerCase();

  box.innerHTML = "";

  const filtered = allEntries.filter(item => {
    const title = (item.title || "").toLowerCase();
    const content = (item.content || "").toLowerCase();
    const category = (item.category || "সাধারণ").toLowerCase();

    return (
      title.includes(query) ||
      content.includes(query) ||
      category.includes(query)
    );
  });

  if (!filtered.length) {
    box.textContent = "কোনো তথ্য পাওয়া যায়নি।";
    return;
  }

  filtered.forEach(item => {
    const article = document.createElement("article");
    article.className = "entry";

    const heading = document.createElement("h3");
    heading.textContent = item.title;

    const category = document.createElement("p");
    category.textContent = "ক্যাটাগরি: " + (item.category || "সাধারণ");

    const content = document.createElement("p");
    content.textContent = item.content;

    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "সম্পাদনা";

    edit.addEventListener("click", () => {
      editingId = item.id;

      $("title").value = item.title;
      $("content").value = item.content;
      $("category").value = item.category || "সাধারণ";

      $("saveBtn").textContent = "পরিবর্তন সংরক্ষণ";
      $("cancelEditBtn").hidden = false;

      window.scrollTo({ top: 0, behavior: "smooth" });
      $("title").focus();

      msg("তথ্য পরিবর্তন করে সংরক্ষণ করুন।");
    });

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "মুছে ফেলুন";

    del.addEventListener("click", async () => {
      if (!confirm("এই তথ্যটি স্থায়ীভাবে মুছে ফেলতে চান?")) return;

      const { error } = await client
        .from("vault_entries")
        .delete()
        .eq("id", item.id);

      if (error) {
        msg("মুছে ফেলা যায়নি: " + error.message);
      } else {
        msg("তথ্য মুছে ফেলা হয়েছে।");
        await loadEntries();
      }
    });

    article.append(heading, category, content, edit, del);
    box.append(article);
  });
}

function cancelEdit() {
  editingId = null;

  $("title").value = "";
  $("content").value = "";
  $("category").value = "সাধারণ";

  $("saveBtn").textContent = "সংরক্ষণ করুন";
  $("cancelEditBtn").hidden = true;
}

// তথ্য সংরক্ষণ ও সম্পাদনা
async function saveEntry() {
  const title = $("title").value.trim();
  const content = $("content").value.trim();
  const category = $("category").value || "সাধারণ";

  if (!title || !content) {
    msg("শিরোনাম ও তথ্য লিখুন।");
    return;
  }

  $("saveBtn").disabled = true;
  msg("তথ্য সংরক্ষণ হচ্ছে...");

  try {
    let result;

    if (editingId !== null) {
      result = await client
        .from("vault_entries")
        .update({ title, content, category })
        .eq("id", editingId);
    } else {
      const { data, error } = await client.auth.getUser();

      if (error || !data.user) {
        msg("আবার লগইন করুন।");
        return;
      }

      result = await client
        .from("vault_entries")
        .insert({
          user_id: data.user.id,
          title,
          content,
          category
        });
    }

    if (result.error) {
      msg("সমস্যা: " + result.error.message);
      return;
    }

    cancelEdit();
    await loadEntries();
    msg("তথ্য সফলভাবে সংরক্ষিত হয়েছে!");

  } catch (error) {
    msg("সমস্যা: " + error.message);
  } finally {
    $("saveBtn").disabled = false;
  }
}

$("saveBtn").addEventListener("click", saveEntry);
$("cancelEditBtn").addEventListener("click", cancelEdit);
$("search").addEventListener("input", renderEntries);

// লগইন
$("loginBtn").addEventListener("click", async () => {
  msg("লগইন হচ্ছে...");

  const { error } = await client.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });

  if (error) {
    msg("লগইন সমস্যা: " + error.message);
  } else {
    $("password").value = "";
    msg("লগইন সফল হয়েছে!");
    await refresh();
  }
});

// লগআউট
$("logoutBtn").addEventListener("click", async () => {
  const { error } = await client.auth.signOut();

  if (error) {
    msg(error.message);
  } else {
    stopSecurity();
    allEntries = [];
    cancelEdit();
    showVault(null);
    msg("সফলভাবে লগআউট হয়েছে।");
  }
});

// পাসওয়ার্ড পরিবর্তন
$("changePasswordBtn").addEventListener("click", async () => {
  const password = $("changePassword").value;

  if (password.length < 8) {
    msg("কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিন।");
    return;
  }

  msg("পাসওয়ার্ড পরিবর্তন হচ্ছে...");

  const { data, error: sessionError } = await client.auth.getSession();

  if (sessionError || !data.session) {
    msg("লগইন সেশন পাওয়া যায়নি। আবার লগইন করুন।");
    return;
  }

  const { error } = await client.auth.updateUser({ password });

  if (error) {
    msg("পাসওয়ার্ড পরিবর্তন হয়নি: " + error.message);
  } else {
    $("changePassword").value = "";
    msg("পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!");
  }
});

// পাসওয়ার্ড রিসেট ইমেইল
$("resetBtn").addEventListener("click", async () => {
  const email = $("email").value.trim();

  if (!email) {
    msg("আগে আপনার Gmail লিখুন।");
    return;
  }

  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });

  msg(error
    ? "সমস্যা: " + error.message
    : "পাসওয়ার্ড রিসেটের নির্দেশনা ইমেইলে পাঠানো হয়েছে।"
  );
});

// রিসেট লিংক থেকে নতুন পাসওয়ার্ড
$("updatePasswordBtn").addEventListener("click", async () => {
  const password = $("newPassword").value;

  if (password.length < 8) {
    msg("কমপক্ষে ৮ অক্ষরের নতুন পাসওয়ার্ড দিন।");
    return;
  }

  const { error } = await client.auth.updateUser({ password });

  if (error) {
    msg("সমস্যা: " + error.message);
  } else {
    $("newPassword").value = "";
    $("recoveryBox").hidden = true;
    isRecoveringPassword = false;

    msg("নতুন পাসওয়ার্ড সফলভাবে সেট হয়েছে!");
    await refresh();
  }
});

// JSON ব্যাকআপ ডাউনলোড
$("backupBtn").addEventListener("click", () => {
  if (!allEntries.length) {
    msg("ব্যাকআপ করার মতো কোনো তথ্য নেই।");
    return;
  }

  const backup = {
    app: "AZAM Personal Vault",
    backupDate: new Date().toISOString(),
    entries: allEntries
  };

  const file = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");

  link.href = url;
  link.download = "AZAM-Personal-Vault-Backup.json";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 3000);

  msg("ব্যাকআপ ডাউনলোড শুরু হয়েছে।");
});

// লগইন অবস্থা পরীক্ষা
async function refresh() {
  const { data, error } = await client.auth.getSession();

  if (error) {
    msg(error.message);
    return;
  }

  showVault(data.session);

  if (data.session) {
    startSecurity();
    await loadEntries();
  } else {
    stopSecurity();
    allEntries = [];
  }
}

// Auth পরিবর্তন পর্যবেক্ষণ
client.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    isRecoveringPassword = true;
    stopSecurity();

    $("loginBox").hidden = true;
    $("vaultBox").hidden = true;
    $("recoveryBox").hidden = false;
    return;
  }

  if (event === "SIGNED_OUT") {
    stopSecurity();
    allEntries = [];
    showVault(null);
    return;
  }

  showVault(session);

  if (session && !isRecoveringPassword) {
    startSecurity();

    setTimeout(() => {
      loadEntries().catch(error => msg(error.message));
    }, 0);
  }
});

refresh().catch(error => msg(error.message));
