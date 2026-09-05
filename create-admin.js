const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://backend.appmiaoda.com/projects/supabase331454395508113408',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMDk4NDUyMDg2LCJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwic3ViIjoiYW5vbiJ9.A3cFRx15YmT0DQbY3d0DFLMzsj8FmgzMLaCgXF4LGn0'
);

(async () => {
  const username = 'admin';
  const password = '8e41d4bff2c147b4A1!';
  const { data, error } = await supabase.auth.signUp({
    email: `${username}@miaoda.com`,
    password,
    options: { data: { username, role: 'admin' } },
  });
  if (error) {
    console.error('SignUp error:', error.message);
    process.exit(1);
  }
  console.log('Created user:', data.user?.id);
})();
