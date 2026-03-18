import { useState } from "react";
import { useNavigate } from "react-router";
import { Zap, Mail, Lock } from "lucide-react";

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simulate login
    const token = `token_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem("pronoteBoost_token", token);
    localStorage.setItem("pronoteBoost_user", JSON.stringify({ email }));
    localStorage.setItem("pronoteBoost_credits", "0"); // No credits initially
    
    navigate("/buy-credits");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-[#396155] flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg text-gray-900">Chrome Extension</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Title */}
        <div className="mb-6">
          <h2 className="text-lg text-gray-900 mb-2">Se connecter</h2>
          <p className="text-sm text-gray-600">
            Accède à ton compte extension
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div>
            <label className="text-sm text-gray-700 mb-2 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.fr"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#396155]"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-700 mb-2 block">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#396155]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-[#396155] hover:bg-[#2a4a40] text-white py-3 px-4 rounded-lg transition-colors"
          >
            Se connecter
          </button>
        </form>

        {/* Create account link */}
        <div className="text-center">
          <button
            onClick={() => navigate("/create-account")}
            className="text-sm text-[#396155] hover:underline"
          >
            Pas encore de compte ? Créer un compte
          </button>
        </div>
      </div>
    </div>
  );
}
