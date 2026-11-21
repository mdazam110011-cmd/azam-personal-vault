
const message = document.getElementById("message");

function showError(text) {
  message.textContent = text;
}

async function startApp() {
  try {
    const cfg = window.AZAM_CONFIG;

    if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
      throw new Error("Supabase-এর সংযোগের তথ্য পাওয়া যায়নি।");
    }

    if (!window.supabase) {
      throw new Error("Supabase লাইব্রেরি লোড হয়নি।");
    }

    const client = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_ANON_KEY
    );

    const loginBox = document.getElementById("loginBox");
    const vaultBox = document.getElementById("vaultBox");

    async function loadEntries() {
      const box = document.getElementById("entries");
      box.innerHTML = "তথ্য লোড হচ্ছে...";

      const { data, error } = await client
        .from("vault_entries")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        box.textContent = "তথ্য লোড হয়নি: " + error.message;
        return;
      }

      box.innerHTML = "";

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

    async function refresh() {
      const { data, error } = await client.auth.getSession();

      if (error) throw error;

      const session = data.session;
      loginBox.hidden = !!session;
      vaultBox.hidden = !session;

      if (session) await loadEntries();
    }

    document.getElementById("loginBtn").onclick = async () => {
      try {
        showError("লগইন হচ্ছে...");

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        if (!email || !password) {
          showError("Gmail ও পাসওয়ার্ড লিখুন।");
          return;
        }

        const { error } = await client.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          showError("লগইন হয়নি: " + error.message);
          return;
        }

        showError("");
        await refresh();

      } catch (error) {
        showError("সমস্যা: " + error.message);
      }
    };

    document.getElementById("logoutBtn").onclick = async () => {
      const { error } = await client.auth.signOut();

      if (error) {
        showError(error.message);
        return;
      }

      await refresh();
    };

    document.getElementById("saveBtn").onclick = async () => {
      try {
        const title = document.getElementById("title").value.trim();
        const content = document.getElementById("content").value.trim();

        if (!title || !content) {
          showError("শিরোনাম ও তথ্য লিখুন।");
          return;
        }

        const { data: { user }, error: userError } =
          await client.auth.getUser();

        if (userError || !user) {
          showError("আবার লগইন করুন।");
          return;
        }

        const { error } = await client
          .from("vault_entries")
          .insert({
            user_id: user.id,
            title,
            content
          });

        if (error) {
          showError("সংরক্ষণ হয়নি: " + error.message);
          return;
        }

        showError("তথ্য সফলভাবে সংরক্ষিত হয়েছে!");

        document.getElementById("title").value = "";
        document.getElementById("content").value = "";

        await loadEntries();

      } catch (error) {
        showError("সমস্যা: " + error.message);
      }
    };

    await refresh();

  } catch (error) {
    showError("ওয়েবসাইটের সমস্যা: " + error.message);
  }
}

startApp();
