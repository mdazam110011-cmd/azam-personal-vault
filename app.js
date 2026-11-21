
const cfg = window.AZAM_CONFIG;

const client = window.supabase.createClient(
  cfg.SUPABASE_URL,
  cfg.SUPABASE_ANON_KEY
);

const loginBox = document.getElementById("loginBox");
const vaultBox = document.getElementById("vaultBox");
const message = document.getElementById("message");

async function refresh() {
  const { data, error } = await client.auth.getSession();

  if (error) {
    message.textContent = error.message;
    return;
  }

  const session = data.session;
  loginBox.hidden = !!session;
  vaultBox.hidden = !session;

  if (session) await loadEntries();
}

document.getElementById("loginBtn").onclick = async () => {
  message.textContent = "লগইন হচ্ছে...";

  const { error } = await client.auth.signInWithPassword({
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value
  });

  if (error) {
    message.textContent = error.message;
  } else {
    message.textContent = "লগইন সফল হয়েছে!";
    await refresh();
  }
};

document.getElementById("logoutBtn").onclick = async () => {
  await client.auth.signOut();
  await refresh();
};

document.getElementById("saveBtn").onclick = async () => {
  const title = document.getElementById("title").value.trim();
  const content = document.getElementById("content").value.trim();

  if (!title || !content) {
    message.textContent = "শিরোনাম ও তথ্য লিখুন।";
    return;
  }

  const { data } = await client.auth.getUser();

  if (!data.user) {
    message.textContent = "আবার লগইন করুন।";
    return;
  }

  const { error } = await client.from("vault_entries").insert({
    user_id: data.user.id,
    title,
    content
  });

  message.textContent = error
    ? error.message
    : "তথ্য সংরক্ষণ হয়েছে।";

  if (!error) {
    document.getElementById("title").value = "";
    document.getElementById("content").value = "";
    await loadEntries();
  }
};

async function loadEntries() {
  const box = document.getElementById("entries");
  box.innerHTML = "";

  const { data, error } = await client
    .from("vault_entries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    box.textContent = error.message;
    return;
  }

  data.forEach(item => {
    const article = document.createElement("article");
    article.className = "entry";

    const heading = document.createElement("h3");
    heading.textContent = item.title;

    const content = document.createElement("div");
    content.textContent = item.content;

    article.append(heading, content);
    box.append(article);
  });
}

client.auth.onAuthStateChange(() => {
  refresh();
});

refresh().catch(error => {
  message.textContent = "সমস্যা: " + error.message;
});
