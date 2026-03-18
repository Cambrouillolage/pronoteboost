import { useState } from "react";
import { useNavigate } from "react-router";
import { Zap, Mail, Lock } from "lucide-react";

export function CreateAccount() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simulate account creation
    const userData = { email };
    localStorage.setItem("pronoteBoost_pendingUser", JSON.stringify(userData));
    
    // Simulate successful account creation and redirect to buy credits
    localStorage.setItem("pronoteBoost_token", "simulated_token_" + Date.now());
    localStorage.setItem("pronoteBoost_credits", "0");
    
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
        {/* Icon and message */}
        <div className="mb-6 text-center">
          <div className="w-12 h-12 bg-[#ff981d]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Zap className="w-6 h-6 text-[#ff981d]" />
          </div>
          <h2 className="text-lg text-gray-900 mb-2">
            Tes crédits gratuits sont terminés
          </h2>
          <p className="text-sm text-gray-600 mb-1">
            Tu as utilisé tes 4 crédits offerts.
          </p>
          <p className="text-sm text-gray-600">
            Crée ton compte pour continuer à générer des appréciations automatiquement.
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
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-[#396155] hover:bg-[#2a4a40] text-white py-3 px-4 rounded-lg transition-colors"
          >
            Créer mon compte
          </button>

          <p className="text-xs text-center text-gray-500">
            Création instantanée, pas d'email de vérification.
          </p>
        </form>

        {/* Login link */}
        <div className="text-center">
          <button
            onClick={() => navigate("/login")}
            className="text-sm text-[#396155] hover:underline"
          >
            Déjà un compte ? Se connecter
          </button>
        </div>

        {/* Offer highlight */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="bg-gradient-to-br from-[#ff981d]/10 to-[#ff981d]/5 border border-[#ff981d]/20 rounded-lg p-4 text-center">
            <p className="text-sm font-medium text-gray-900 mb-1">
              🎉 Offre de lancement
            </p>
            <p className="text-xs text-gray-600">
              <span className="font-bold text-[#ff981d]">200 crédits pour 1,99€</span> après création de compte
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}