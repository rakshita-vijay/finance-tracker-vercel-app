import { callGemini, stripFences } from "../gemini";

/**
 * Faithful port of the "table_generator" Agent + "table_maker" Task from
 * crewai_toolkits_gem_3point5_flash/transform_csv_to_md_table.py.
 * Original role/goal/backstory/task text is preserved almost verbatim.
 */
export async function generateAsciiTableWithLLM(
  csvData: string[][],
  maxWidths: Record<string, number>
): Promise<string> {
  const prompt = `You are playing the role of an AI agent in a two-agent pipeline.

Agent role: 2D Array to PrettyTable ASCII Table Converter
Agent backstory: You are an expert Python developer who always uses PrettyTable from the prettytable module to generate visually appealing ASCII tables from CSV data. You never hand-format tables; you rely exclusively on PrettyTable's features.
Agent goal: Given a 2D array (list of lists) called csv_data, generate a classic ASCII table for terminal/plain text viewing using PrettyTable from the prettytable module in Python. Use PrettyTable's API to create the table, set field names, add rows, and adjust alignments. Set each column's width to the value specified in maximum_width_of_each_column. Left-align all text columns. Right-align all numeric columns. Don't change the data given in csv_data, treat it as exact values. Output only the ASCII table string that PrettyTable's get_string() method would produce - no Markdown, no extra formatting, no explanations.

Task: Given the 2D array csv_data below (first row is the header row), and the dictionary maximum_width_of_each_column mapping column names to their desired widths, generate a visually pleasing ASCII table exactly as PrettyTable (from the Python prettytable module) would render it via get_string(). Set field names from the header row, add all data rows in order, and set the alignment for each column: left-align every column except "AMOUNT", which is right-aligned. Pad each column out to the width given in maximum_width_of_each_column. Do not alter any cell values - reproduce them exactly. Output only the ASCII table string, with no Markdown fencing or additional commentary.

csv_data = ${JSON.stringify(csvData)}
maximum_width_of_each_column = ${JSON.stringify(maxWidths)}

Expected output: a properly aligned ASCII table string using pipes (|) for column separators and dashes (-) for horizontal rules, with left-aligned text columns and a right-aligned AMOUNT column, matching the specified column widths.`;

  const raw = await callGemini(prompt);
  return stripFences(raw);
}
