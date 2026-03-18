import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, RefreshCw, CheckSquare, Square, Zap } from "lucide-react";
import {
  fetchStudentsFromPronote,
  insertAppreciationsIntoPronote,
  isExtensionRuntimeAvailable,
} from "../lib/pronoteBridge";
import { canUseGeminiApi, generateAppreciationWithGemini } from "../lib/gemini";

const sampleAppreciations = {
  bienveillant: "Maxime fournit un travail sérieux et régulier. Sa participation en classe est satisfaisante et ses résultats sont encourageants. Il doit poursuivre ses efforts.",
  neutre: "Élève sérieux et appliqué. Les résultats sont conformes aux attentes. Poursuivre dans cette voie avec la même motivation.",
  pro: "Trimestre satisfaisant. Résultats conformes aux objectifs fixés. Maintenir l'investissement actuel.",
  alarmiste: "Les résultats sont préoccupants et nécessitent une amélioration rapide. Maxime doit redoubler d'efforts pour rattraper son retard.",
};

type Tone = "bienveillant" | "neutre" | "pro" | "alarmiste";

const studentPrinciples = [
  "Participation active",
  "Travail régulier",
  "Progrès visibles",
  "Comportement exemplaire",
  "Efforts soutenus",
  "Besoin de concentration",
];

interface Student {
  id: number;
  rowKey?: string;
  name: string;
  average: string;
  tone: Tone;
  selectedPrinciples: string[];
  appreciation: string;
  isSelected: boolean;
  freeText: string;
}

const initialStudents: Student[] = [
  { id: 1, name: "Maxime Bouet", average: "14.5", tone: "neutre", selectedPrinciples: [], appreciation: "", isSelected: true, freeText: "" },
  { id: 2, name: "Sophie Martin", average: "16.2", tone: "neutre", selectedPrinciples: [], appreciation: "", isSelected: true, freeText: "" },
  { id: 3, name: "Lucas Dupont", average: "12.8", tone: "neutre", selectedPrinciples: [], appreciation: "", isSelected: true, freeText: "" },
  { id: 4, name: "Emma Bernard", average: "15.1", tone: "neutre", selectedPrinciples: [], appreciation: "", isSelected: true, freeText: "" },
  { id: 5, name: "Thomas Petit", average: "9.5", tone: "neutre", selectedPrinciples: [], appreciation: "", isSelected: true, freeText: "" },
  { id: 6, name: "Léa Rousseau", average: "17.3", tone: "neutre", selectedPrinciples: [], appreciation: "", isSelected: true, freeText: "" },
];

export function Generate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isClassMode = searchParams.get("mode") === "class";
  const [credits, setCredits] = useState(4);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [generalTone, setGeneralTone] = useState<Tone>("neutre");
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [studentsSource, setStudentsSource] = useState<"pronote" | "mock">("mock");
  const [infoMessage, setInfoMessage] = useState("");

  useEffect(() => {
    // Load credits
    const savedCredits = localStorage.getItem("pronoteBoost_credits");
    if (savedCredits) {
      setCredits(parseInt(savedCredits));
    }

    // Check if user has credits
    if (parseInt(savedCredits || "4") <= 0) {
      navigate("/create-account");
      return;
    }
  }, [navigate]);

  useEffect(() => {
    let mounted = true;

    const loadStudents = async () => {
      if (!isExtensionRuntimeAvailable()) {
        if (!mounted) {
          return;
        }

        setStudents(initialStudents);
        setStudentsSource("mock");
        setInfoMessage("Mode demo actif: extension Chrome non detectee.");
        setIsLoadingStudents(false);
        return;
      }

      try {
        const pronoteStudents = await fetchStudentsFromPronote();
        if (!mounted) {
          return;
        }

        if (!pronoteStudents.length) {
          throw new Error("Aucun eleve visible detecte dans Pronote.");
        }

        setStudents(
          pronoteStudents.map((student, index) => ({
            id: index + 1,
            rowKey: student.rowKey,
            name: student.name,
            average: "",
            tone: "neutre",
            selectedPrinciples: [],
            appreciation: student.appreciation || "",
            isSelected: true,
            freeText: "",
          })),
        );
        setStudentsSource("pronote");
        setInfoMessage(`${pronoteStudents.length} eleves charges depuis Pronote.`);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setStudents(initialStudents);
        setStudentsSource("mock");
        setInfoMessage(
          `Mode demo actif: ${(error as Error).message || "impossible de lire le tableau Pronote."}`,
        );
      } finally {
        if (mounted) {
          setIsLoadingStudents(false);
        }
      }
    };

    void loadStudents();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedCount = students.filter((student) => student.isSelected).length;
  const selectedWithoutAppreciationCount = students.filter(
    (student) => student.isSelected && !student.appreciation,
  ).length;
  const selectedWithAppreciationCount = students.filter(
    (student) => student.isSelected && student.appreciation,
  ).length;

  const buildFallbackAppreciation = (student: Student) => {
    return sampleAppreciations[student.tone].replace("Maxime", student.name.split(" ")[0]);
  };

  const generateForOneStudent = async (student: Student) => {
    try {
      if (!canUseGeminiApi()) {
        throw new Error("API Gemini non configuree");
      }

      return await generateAppreciationWithGemini({
        studentName: student.name,
        average: student.average,
        tone: student.tone,
        principles: student.selectedPrinciples,
        freeText: student.freeText,
      });
    } catch {
      return buildFallbackAppreciation(student);
    }
  };

  const toggleStudentSelected = (studentId: number) => {
    setStudents(prevStudents => prevStudents.map(s => 
      s.id === studentId ? { ...s, isSelected: !s.isSelected } : s
    ));
  };

  const updateStudentTone = (studentId: number, tone: Tone) => {
    setStudents(prevStudents => prevStudents.map(s => 
      s.id === studentId ? { ...s, tone } : s
    ));
  };

  const toggleStudentPrinciple = (studentId: number, principle: string) => {
    setStudents(prevStudents => prevStudents.map(s => {
      if (s.id === studentId) {
        const selectedPrinciples = s.selectedPrinciples.includes(principle)
          ? s.selectedPrinciples.filter(p => p !== principle)
          : [...s.selectedPrinciples, principle];
        return { ...s, selectedPrinciples };
      }
      return s;
    }));
  };

  const updateFreeText = (studentId: number, freeText: string) => {
    setStudents(prevStudents => prevStudents.map(s => 
      s.id === studentId ? { ...s, freeText } : s
    ));
  };

  const generateForStudent = async (studentId: number) => {
    const student = students.find(s => s.id === studentId);
    if (!student) {
      return;
    }

    setIsGenerating(true);
    const appreciation = await generateForOneStudent(student);

    setStudents(prevStudents => prevStudents.map(s => {
      if (s.id === studentId) {
        return { ...s, appreciation };
      }
      return s;
    }));

    if (!canUseGeminiApi()) {
      setInfoMessage("Generation locale utilisee (Gemini non configure). Configure VITE_PRONOTEBOOST_API_URL pour activer Gemini.");
    }

    setIsGenerating(false);
  };

  const generateAllSelected = async () => {
    const studentsToGenerate = students.filter(s => s.isSelected && !s.appreciation);
    if (!studentsToGenerate.length) {
      return;
    }

    setIsGenerating(true);
    const generatedRows = await Promise.all(
      studentsToGenerate.map(async student => ({
        id: student.id,
        appreciation: await generateForOneStudent(student),
      })),
    );

    setStudents(prevStudents => prevStudents.map(s => {
      const generated = generatedRows.find(row => row.id === s.id);
      if (!generated) {
        return s;
      }

      return { ...s, appreciation: generated.appreciation };
    }));

    if (!canUseGeminiApi()) {
      setInfoMessage("Generation locale utilisee (Gemini non configure). Configure VITE_PRONOTEBOOST_API_URL pour activer Gemini.");
    }

    setIsGenerating(false);
  };

  const insertAllToPlatform = async () => {
    const selectedStudents = students.filter(s => s.isSelected && s.appreciation);
    if (!selectedStudents.length) {
      return;
    }

    if (selectedStudents.length > credits) {
      alert(`Vous n'avez pas assez de credits. Il vous faut ${selectedStudents.length} credits mais vous n'en avez que ${credits}.`);
      return;
    }

    if (studentsSource !== "pronote" || !isExtensionRuntimeAvailable()) {
      const newCredits = credits - selectedStudents.length;
      setCredits(newCredits);
      localStorage.setItem("pronoteBoost_credits", newCredits.toString());
      navigate(`/success?credits=${newCredits}&count=${selectedStudents.length}&source=demo`);
      return;
    }

    setIsInserting(true);

    try {
      const response = await insertAppreciationsIntoPronote(
        selectedStudents.map(student => ({
          rowKey: student.rowKey,
          name: student.name,
          text: student.appreciation,
        })),
      );

      if (!response.inserted) {
        alert("Aucune appreciation n'a pu etre inseree dans Pronote.");
        return;
      }

      const newCredits = credits - response.inserted;
      setCredits(newCredits);
      localStorage.setItem("pronoteBoost_credits", newCredits.toString());

      if (response.failed > 0) {
        setInfoMessage(`${response.inserted} insertion(s) validee(s), ${response.failed} en echec.`);
      }

      navigate(`/success?credits=${newCredits}&count=${response.inserted}&failed=${response.failed}&source=pronote`);
    } catch (error) {
      alert((error as Error).message || "Echec de l'insertion dans Pronote.");
    } finally {
      setIsInserting(false);
    }
  };

  const applyGeneralTone = () => {
    setStudents(prevStudents => prevStudents.map(s => ({ ...s, tone: generalTone })));
  };

  const uncheckAll = () => {
    setStudents(prevStudents => prevStudents.map(s => ({ ...s, isSelected: false })));
  };

  const checkAll = () => {
    setStudents((prevStudents) => prevStudents.map((student) => ({ ...student, isSelected: true })));
  };

  const GeneralToneButton = ({ tone, label }: { tone: Tone; label: string }) => (
    <button
      onClick={() => setGeneralTone(tone)}
      className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
        generalTone === tone
          ? "bg-[#396155] text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );

  const StudentToneButton = ({ studentId, tone, label }: { studentId: number; tone: Tone; label: string }) => {
    const student = students.find(s => s.id === studentId);
    return (
      <button
        onClick={() => updateStudentTone(studentId, tone)}
        className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
          student?.tone === tone
            ? "bg-[#396155] text-white"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(isClassMode ? "/dashboard" : "/")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-base text-gray-900">
              {isClassMode ? "Appréciations de la classe" : "Appréciation du trimestre"}
            </h1>
          </div>
          <div className="bg-gradient-to-br from-[#396155] to-[#2a4a40] rounded-lg px-4 py-2 flex items-center gap-2 shadow-md">
            <Zap className="w-4 h-4 text-[#ff981d]" />
            <div className="text-white">
              <div className="text-xs font-medium">Crédits</div>
              <div className="text-lg font-bold">{credits}</div>
            </div>
          </div>
        </div>

        {/* General tone selector */}
        <div className="mb-3">
          {(isLoadingStudents || infoMessage) && (
            <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {isLoadingStudents ? "Chargement des eleves Pronote..." : infoMessage}
            </div>
          )}
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-700">Ton Général</label>
            <div className="flex items-center gap-3">
              <button
                onClick={checkAll}
                className="text-xs text-gray-600 hover:text-gray-900 underline"
              >
                Tout cocher
              </button>
              <button
                onClick={uncheckAll}
                className="text-xs text-gray-600 hover:text-gray-900 underline"
              >
                Décocher tout
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            <GeneralToneButton tone="bienveillant" label="Bienveillant" />
            <GeneralToneButton tone="neutre" label="Neutre" />
            <GeneralToneButton tone="pro" label="Pro" />
            <GeneralToneButton tone="alarmiste" label="Alarmiste" />
          </div>
          <button
            onClick={applyGeneralTone}
            className="text-xs text-[#396155] hover:text-[#2a4a40] underline"
          >
            Appliquer à tous les élèves
          </button>
        </div>
      </div>

      {/* Content - Student list */}
      <div className="flex-1 overflow-y-auto pb-20">
        {students.map((student) => (
          <div key={student.id} className="border-b border-gray-200">
            {/* Student header */}
            <div className="p-4 bg-white hover:bg-gray-50">
              <div className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => toggleStudentSelected(student.id)}
                  className="flex-shrink-0"
                >
                  {student.isSelected ? (
                    <CheckSquare className="w-5 h-5 text-[#396155]" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{student.name}</span>
                  <span className="text-xs text-gray-500">Moy: {student.average}</span>
                </div>
              </div>

              {/* Expanded content */}
              {student.isSelected && (
                <div className="mt-4 space-y-4">
                  {/* Tone for this student */}
                  <div>
                    <label className="text-xs text-gray-700 mb-2 block">Ton pour cet élève</label>
                    <div className="flex flex-wrap gap-2">
                      <StudentToneButton studentId={student.id} tone="bienveillant" label="Bienveillant" />
                      <StudentToneButton studentId={student.id} tone="neutre" label="Neutre" />
                      <StudentToneButton studentId={student.id} tone="pro" label="Pro" />
                      <StudentToneButton studentId={student.id} tone="alarmiste" label="Alarmiste" />
                    </div>
                  </div>

                  {/* Principles */}
                  <div>
                    <label className="text-xs text-gray-700 mb-2 block">Grands principes à noter</label>
                    <div className="grid grid-cols-2 gap-2">
                      {studentPrinciples.map((principle) => (
                        <button
                          key={principle}
                          onClick={() => toggleStudentPrinciple(student.id, principle)}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors border ${
                            student.selectedPrinciples.includes(principle)
                              ? "bg-[#396155] text-white border-[#396155]"
                              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {student.selectedPrinciples.includes(principle) ? (
                            <CheckSquare className="w-3 h-3" />
                          ) : (
                            <Square className="w-3 h-3" />
                          )}
                          <span className="text-[10px]">{principle}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Free text field */}
                  <div>
                    <label className="text-xs text-gray-700 mb-2 block">Notes personnelles (optionnel)</label>
                    <input
                      type="text"
                      value={student.freeText}
                      onChange={(e) => updateFreeText(student.id, e.target.value)}
                      placeholder="Ex: mention particulière, contexte..."
                      className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#396155] text-xs"
                    />
                  </div>

                  {/* Generated appreciation */}
                  {student.appreciation && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-700 mb-2 block">Appréciation générée</label>
                        <textarea
                          value={student.appreciation}
                          onChange={(e) => {
                            setStudents(prevStudents => prevStudents.map(s => 
                              s.id === student.id ? { ...s, appreciation: e.target.value } : s
                            ));
                          }}
                          className="w-full p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#396155] text-xs"
                          rows={4}
                        />
                      </div>
                      <button
                        onClick={() => void generateForStudent(student.id)}
                        disabled={isGenerating || isInserting || isLoadingStudents}
                        className="w-full bg-white hover:bg-gray-50 text-gray-700 py-2 px-3 rounded-lg border border-gray-200 transition-colors flex items-center justify-center gap-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Regénérer
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky bottom button */}
      {selectedCount > 0 && (
        <div className="sticky bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg">
          {selectedWithoutAppreciationCount > 0 ? (
            <button
              onClick={() => void generateAllSelected()}
              disabled={isGenerating || isInserting || isLoadingStudents}
              className="w-full bg-[#396155] hover:bg-[#2a4a40] text-white py-3 px-4 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating
                ? "Generation en cours..."
                : isClassMode
                  ? `Generer ${selectedWithoutAppreciationCount} appreciation${selectedWithoutAppreciationCount > 1 ? "s" : ""} pour la classe`
                  : `Generer ${selectedWithoutAppreciationCount} appreciation${selectedWithoutAppreciationCount > 1 ? "s" : ""}`}
            </button>
          ) : (
            <button
              onClick={() => void insertAllToPlatform()}
              disabled={isGenerating || isInserting || isLoadingStudents}
              className="w-full bg-[#ff981d] hover:bg-[#e88a1a] text-white py-3 px-4 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isInserting
                ? "Insertion en cours..."
                : isClassMode
                  ? `Inserer ${selectedWithAppreciationCount} appreciation${selectedWithAppreciationCount > 1 ? "s" : ""} dans Pronote`
                  : `Inserer ${selectedWithAppreciationCount} appreciation${selectedWithAppreciationCount > 1 ? "s" : ""} dans la plateforme`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}