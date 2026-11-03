import Editor from "@monaco-editor/react";

export const LANGUAGES = [
  { id: "python", label: "Python", sample: 'def promedio(nums):\n    return sum(nums) / len(nums)\n\nprint(promedio([]))\n' },
  { id: "javascript", label: "JavaScript", sample: "function suma(a, b) {\n  return a + b\n}\nconsole.log(suma(1))\n" },
  { id: "typescript", label: "TypeScript", sample: "const saludo = (n: string): string => `Hola ${n}`;\n" },
  { id: "java", label: "Java", sample: "public class Main {\n  public static void main(String[] args) {\n    System.out.println(\"Hola\");\n  }\n}\n" },
  { id: "cpp", label: "C++", sample: "#include <iostream>\nint main() {\n  std::cout << \"Hola\";\n}\n" },
  { id: "csharp", label: "C#", sample: "Console.WriteLine(\"Hola\");\n" },
  { id: "go", label: "Go", sample: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hola")\n}\n' },
];

interface Props {
  value: string;
  language: string;
  onChange: (v: string) => void;
}

export default function CodeEditor({ value, language, onChange }: Props) {
  return (
    <Editor
      height="100%"
      theme="vs-dark"
      language={language}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        tabSize: 2,
        padding: { top: 12 },
      }}
    />
  );
}
