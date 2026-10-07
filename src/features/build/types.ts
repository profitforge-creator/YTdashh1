import type { ConceptRow, ConceptSourceRow, GenerationJobRow, ProjectMessageRow, ProjectRow } from "@/types/database";
import type { Answers } from "@/lib/interview/schema";

export interface ConceptView extends ConceptRow {
  sources: ConceptSourceRow[];
}

export interface WorkspaceData {
  project: ProjectRow;
  answers: Answers;
  confirmed: boolean;
  messages: ProjectMessageRow[];
  concepts: ConceptView[];
  latestJob: GenerationJobRow | null;
  researchCredits: number;
  canEdit: boolean;
}
