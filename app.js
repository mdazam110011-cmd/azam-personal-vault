
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
    edit.textContent = "সম্পাদনা";
    edit.onclick = () => {
      $("title").value = item.title;
      $("content").value = item.content;
      editingId = item.id;
      $("saveBtn").textContent = "পরিবর্তন সংরক্ষণ";
      $("cancelEditBtn").hidden = false;
      window.scrollTo(0, 0);
    };

    const del = document.createElement("button");
    del.textContent = "মুছে ফেলুন";
    del.onclick = async () => {
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
    };

    article.append(heading, content, edit, del);
    box.append(article);
  });
}

async function refresh() {
  const { data, error } = await client.auth.getSession();

  if (error) {
    msg(error.message);
    return;
  }

  const session = data.session;
  showVault(session);

  if (session) await loadEntries();
}

$("loginBtn").onclick = async () => {
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
};

$("saveBtn").onclick = async () => {
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
    const { data: { user }, error: userError } =
      await client.auth.getUser();

    if (userError || !user) {
      msg("আবার লগইন করুন।");
      return;
    }

    result = await client
      .from("vault_entries")
      .insert({
        user_id: user.id,
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
};

function cancelEdit() {
  editingId = null;
  $("title").value = "";
  $("content").value = "";
  $("saveBtn").textContent = "সংরক্ষণ করুন";
  $("cancelEditBtn").hidden = true;
}

$("cancelEditBtn").onclick = cancelEdit;

$("search").oninput = renderEntries;

$("logoutBtn").onclick = async () => {
  const { error } = await client.auth.signOut();

  if (error) {
    msg(error.message);
  } else {
    showVault(null);
    msg("লগআউট হয়েছে।");
  }
};

// পাসওয়ার্ড পরিবর্তন
$("changePasswordBtn").onclick = async () => {
  const password = $("changePassword").value;

  if (password.length < 8) {
    msg("কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিন।");
    return;
  }

  const { error } = await client.auth.updateUser({
    password
  });

  if (error) {
    msg(error.message);
  } else {
    msg("পাসওয়ার্ড পরিবর্তন হয়েছে।");
    $("changePassword").value = "";
  }
};

// পাসওয়ার্ড রিসেট ইমেইল
$("resetBtn").onclick = async () => {
  const email = $("email").value.trim();

  if (!email) {
    msg("আগে আপনার Gmail লিখুন।");
    return;
  }

  const { error } = await client.auth.resetPasswordForEmail(
    email,
    {
      redirectTo: window.location.origin + window.location.pathname
    }
  );

  msg(error
    ? "সমস্যা: " + error.message
    : "পাসওয়ার্ড রিসেটের নির্দেশনা ইমেইলে পাঠানো হয়েছে।"
  );
};

// রিসেট লিংক থেকে ফিরে নতুন পাসওয়ার্ড
$("updatePasswordBtn").onclick = async () => {
  const password = $("newPassword").value;

  if (password.length < 8) {
    msg("কমপক্ষে ৮ অক্ষরের নতুন পাসওয়ার্ড দিন।");
    return;
  }

  const { error } = await client.auth.updateUser({ password });

  if (error) {
    msg("সমস্যা: " + error.message);
  } else {
    msg("নতুন পাসওয়ার্ড সফলভাবে সেট হয়েছে।");
    $("newPassword").value = "";
    $("recoveryBox").hidden = true;
    await refresh();
  }
};

// JSON ব্যাকআপ ডাউনলোড
$("backupBtn").onclick = () => {
  const file = new Blob(
    [JSON.stringify(allEntries, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");

  link.href = url;
  link.download = "AZAM-Personal-Vault-Backup.json";
  link.click();

  URL.revokeObjectURL(url);
  msg("ব্যাকআপ ডাউনলোড শুরু হয়েছে।");
};

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
    
