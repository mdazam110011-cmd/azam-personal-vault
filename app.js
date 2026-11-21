
const cfg = window.AZAM_CONFIG;

const client = window.supabase.createClient(
  cfg.SUPABASE_URL,
  cfg.SUPABASE_ANON_KEY
);

const $ = id => document.getElementById(id);

let editingId = null;
let allEntries = [];

function msg(text) {
  $("message").textContent = text;
}

function showVault(session) {
  $("loginBox").hidden = !!session;
  $("vaultBox").hidden = !session;
}

async function loadEntries() {
  const box = $("entries");
  box.textContent = "তথ্য লোড হচ্ছে...";

  const { data, error } = await client
    .from("vault_entries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    box.textContent = error.message;
    return;
  }

  allEntries = data || [];
  renderEntries();
}

function renderEntries() {
  const box = $("entries");
  const query = $("search").value.trim().toLowerCase();

  box.innerHTML = "";

  const filtered = allEntries.filter(item =>
    item.title.toLowerCase().includes(query) ||
    item.content.toLowerCase().includes(query)
  );

  if (!filtered.length) {
    box.textContent = "কোনো তথ্য পাওয়া যায়নি।";
    return;
  }

  filtered.forEach(item => {
    const article = document.createElement("article");
    article.className = "entry";

    const heading = document.createElement("h3");
    heading.textContent = item.title;

    const content = document.createElement("p");
    content.textContent = item.content;

    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "সম্পাদনা";

    edit.addEventListener("click", () => {
      editingId = item.id;

      $("title").value = item.title;
      $("content").value = item.content;

      $("saveBtn").textContent = "পরিবর্তন সংরক্ষণ";
      $("cancelEditBtn").hidden = false;

      window.scrollTo({ top: 0, behavior: "smooth" });
      $("title").focus();

      msg("এখন তথ্য পরিবর্তন করে সংরক্ষণ করুন।");
    });

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "মুছে ফেলুন";

    del.addEventListener("click", async () => {
      if (!confirm("এই তথ্যটি মুছে ফেলতে চান?")) return;

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

    article.append(heading, content, edit, del);
    box.append(article);
  });
}

function cancelEdit() {
  editingId = null;
  $("title").value = "";
  $("content").value = "";
  $("saveBtn").textContent = "সংরক্ষণ করুন";
  $("cancelEditBtn").hidden = true;
}

async function refresh() {
  const { data, error } = await client.auth.getSession();

  if (error) {
    msg(error.message);
    return;
  }

  showVault(data.session);

  if (data.session) {
    await loadEntries();
  }
}

// লগইন
$("loginBtn").addEventListener("click", async () => {
  msg("লগইন হচ্ছে...");

  const { error } = await client.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });

  if (error) {
    msg(error.message);
  } else {
    msg("লগইন সফল হয়েছে!");
    await refresh();
  }
});

// তথ্য সংরক্ষণ ও সম্পাদনা
$("saveBtn").addEventListener("click", async () => {
  const title = $("title").value.trim();
  const content = $("content").value.trim();

  if (!title || !content) {
    msg("শিরোনাম ও তথ্য লিখুন।");
    return;
  }

  let result;

  if (editingId !== null) {
    result = await client
      .from("vault_entries")
      .update({ title, content })
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
        content
      });
  }

  if (result.error) {
    msg("সমস্যা: " + result.error.message);
    return;
  }

  msg("তথ্য সফলভাবে সংরক্ষিত হয়েছে!");
  cancelEdit();
  await loadEntries();
});

$("cancelEditBtn").addEventListener("click", cancelEdit);

// সার্চ
$("search").addEventListener("input", renderEntries);

// লগআউট
$("logoutBtn").addEventListener("click", async () => {
  const { error } = await client.auth.signOut();

  if (error) {
    msg(error.message);
  } else {
    allEntries = [];
    showVault(null);
    msg("লগআউট হয়েছে।");
  }
});

// পাসওয়ার্ড পরিবর্তন
$("changePasswordBtn").addEventListener("click", async () => {
  const password = $("changePassword").value;

  if (password.length < 8) {
    msg("কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিন।");
    return;
  }

  const { error } = await client.auth.updateUser({ password });

  if (error) {
    msg(error.message);
  } else {
    msg("পাসওয়ার্ড পরিবর্তন হয়েছে।");
    $("changePassword").value = "";
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
    : "রিসেট নির্দেশনা ইমেইলে পাঠানো হয়েছে।"
  );
});

// নতুন পাসওয়ার্ড সেট
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
    msg("নতুন পাসওয়ার্ড সেট হয়েছে।");
    $("newPassword").value = "";
    $("recoveryBox").hidden = true;
    await refresh();
  }
});

// JSON ব্যাকআপ
$("backupBtn").addEventListener("click", () => {
  const file = new Blob(
    [JSON.stringify(allEntries, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");

  link.href = url;
  link.download = "AZAM-Personal-Vault-Backup.json";
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 2000);
  msg("ব্যাকআপ ডাউনলোড শুরু হয়েছে।");
});

// পাসওয়ার্ড রিকভারি
client.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    $("loginBox").hidden = true;
    $("vaultBox").hidden = true;
    $("recoveryBox").hidden = false;
    return;
  }

  showVault(session);

  if (session) {
    loadEntries();
  }
});

refresh().catch(error => msg(error.message));
