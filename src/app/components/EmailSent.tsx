import { useNavigate } from "react-router";
import { Mail, RefreshCw } from "lucide-react";
import { useState } from "react";

export function EmailSent() {
  const navigate = useNavigate();
  const [resent, setResent] = useState(false);

  const handleResend = () => {
    setResent(true);
    setTimeout(() => setResent(false), 3000);
  };

  const handleVerified = () => {
    // Simulate email verification
    navigate("/login");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-base text-gray-900">Chrome Extension</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center">
        {/* Mail icon */}
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Mail className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-lg text-gray-900 mb-2 text-center">
          Vérifie ton email
        </h2>

        {/* Message */}
        <p className="text-sm text-gray-600 mb-2 text-center">
          Un email de confirmation vient d'être envoyé.
        </p>
        <p className="text-sm text-gray-600 mb-8 text-center">
          Clique sur le lien dans ce mail pour activer ton compte.
        </p>

        {/* Verified button */}
        <button
          onClick={handleVerified}
          className="w-full bg-[#396155] hover:bg-[#2a4a40] text-white py-3 px-4 rounded-lg transition-colors mb-4"
        >
          J'ai vérifié mon email
        </button>

        {/* Resend link */}
        <button
          onClick={handleResend}
          className="text-sm text-[#396155] hover:underline flex items-center gap-2"
          disabled={resent}
        >
          {resent ? (
            <>
              <RefreshCw className="w-4 h-4" />
              Email renvoyé
            </>
          ) : (
            "Renvoyer l'email"
          )}
        </button>
      </div>
    </div>
  );
}
