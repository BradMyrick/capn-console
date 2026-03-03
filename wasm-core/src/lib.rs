use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Field {
    pub name: String,
    pub id: u32,
    pub field_type: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StructDef {
    pub name: String,
    pub fields: Vec<Field>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Schema {
    pub structs: Vec<StructDef>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FieldLayout {
    pub name: String,
    pub id: u32,
    pub field_type: String,
    pub size: u32,
    pub start_offset: u32,
    pub end_offset: u32,
    pub padding_bytes: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StructLayout {
    pub name: String,
    pub total_size: u32,
    pub fields: Vec<FieldLayout>,
}

fn get_field_size_and_align(field_type: &str) -> (u32, u32) {
    let t = field_type.to_uppercase();
    if t.contains("VOID") {
        (0, 1)
    } else if t.contains("BOOL") || t.contains("INT8") {
        (1, 1) // Treat bool as 1 byte for visualization purposes
    } else if t.contains("INT16") {
        (2, 2)
    } else if t.contains("INT32") || t.contains("FLOAT32") {
        (4, 4)
    } else if t.contains("INT64") || t.contains("FLOAT64") {
        (8, 8)
    } else {
        // Pointers: Text, Data, List, Struct, AnyPointer
        (8, 8)
    }
}

pub fn calculate_struct_layout(def: &StructDef) -> StructLayout {
    let mut layouts = Vec::new();
    let mut current_offset = 0;

    for field in &def.fields {
        let (size, align) = get_field_size_and_align(&field.field_type);
        let padding_bytes = if align > 0 {
            (align - (current_offset % align)) % align
        } else {
            0
        };

        let start_offset = current_offset + padding_bytes;
        let end_offset = start_offset + size;

        layouts.push(FieldLayout {
            name: field.name.clone(),
            id: field.id,
            field_type: field.field_type.clone(),
            size,
            start_offset,
            end_offset,
            padding_bytes,
        });

        current_offset = end_offset;
    }

    let struct_padding = (8 - (current_offset % 8)) % 8;
    let total_size = current_offset + struct_padding;

    StructLayout {
        name: def.name.clone(),
        total_size,
        fields: layouts,
    }
}

#[wasm_bindgen]
pub fn calculate_all_layouts(schema_js: JsValue) -> Result<JsValue, JsValue> {
    let schema: Schema = serde_wasm_bindgen::from_value(schema_js)?;
    let layouts: Vec<StructLayout> = schema.structs.iter().map(calculate_struct_layout).collect();
    serde_wasm_bindgen::to_value(&layouts).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LayoutDiff {
    pub original_size: u32,
    pub simulated_size: u32,
    pub bytes_saved: i32,
    pub simulated_layout: StructLayout,
    pub original_layout: StructLayout,
}

#[wasm_bindgen]
pub fn simulate_layout(struct_def_js: JsValue, new_order: Vec<usize>) -> Result<JsValue, JsValue> {
    let original_def: StructDef = serde_wasm_bindgen::from_value(struct_def_js)?;

    if new_order.len() != original_def.fields.len() {
        return Err(JsValue::from_str(
            "new_order length does not match fields length",
        ));
    }

    let mut simulated_def = original_def.clone();
    let mut reordered_fields = Vec::with_capacity(original_def.fields.len());
    for &idx in &new_order {
        if idx >= original_def.fields.len() {
            return Err(JsValue::from_str("Invalid index in new_order"));
        }
        reordered_fields.push(original_def.fields[idx].clone());
    }
    simulated_def.fields = reordered_fields;

    let original_layout = calculate_struct_layout(&original_def);
    let simulated_layout = calculate_struct_layout(&simulated_def);

    let bytes_saved = (original_layout.total_size as i32) - (simulated_layout.total_size as i32);

    let diff = LayoutDiff {
        original_size: original_layout.total_size,
        simulated_size: simulated_layout.total_size,
        bytes_saved,
        simulated_layout,
        original_layout,
    };

    serde_wasm_bindgen::to_value(&diff).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn suggest_optimal_order(struct_def_js: JsValue) -> Result<JsValue, JsValue> {
    let def: StructDef = serde_wasm_bindgen::from_value(struct_def_js)?;

    // Create tuples of (original_index, size, align)
    let mut fields_with_meta: Vec<(usize, u32, u32)> = def
        .fields
        .iter()
        .enumerate()
        .map(|(idx, f)| {
            let (size, align) = get_field_size_and_align(&f.field_type);
            (idx, size, align)
        })
        .collect();

    // Sort logic: Decending by alignment requirement (8 -> 4 -> 2 -> 1)
    // This packing strategy reduces padding in struct layouts
    fields_with_meta.sort_by(|a, b| {
        b.2.cmp(&a.2) // Compare alignments descending
            .then_with(|| b.1.cmp(&a.1)) // Compare sizes descending
    });

    let optimal_order: Vec<usize> = fields_with_meta
        .into_iter()
        .map(|(idx, _, _)| idx)
        .collect();

    // Return Uint32Array back to JS
    serde_wasm_bindgen::to_value(&optimal_order).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn export_schema(schema_js: JsValue) -> Result<String, JsValue> {
    let schema: Schema = serde_wasm_bindgen::from_value(schema_js)?;

    let mut output = String::new();
    output.push_str("# Optimized Cap'n Proto Schema\n");
    output.push_str("# Generated by Cap'n Console\n\n");

    // In a real app we'd preserve the file-level annotations/imports.
    // Here we'll just write a dummy ID to make it syntactically valid.
    output.push_str("@0x1234567890abcdef;\n\n");

    for def in schema.structs {
        output.push_str(&format!("struct {} {{\n", def.name));
        for field in def.fields {
            output.push_str(&format!(
                "  {} @{} :{};\n",
                field.name, field.id, field.field_type
            ));
        }
        output.push_str("}\n\n");
    }

    Ok(output)
}

#[wasm_bindgen]
pub fn reorder_fields(struct_def_js: JsValue, new_order: Vec<usize>) -> Result<JsValue, JsValue> {
    let mut def: StructDef = serde_wasm_bindgen::from_value(struct_def_js)?;

    // Ensure the new_order length matches the fields length
    if new_order.len() != def.fields.len() {
        return Err(JsValue::from_str(
            "new_order length does not match fields length",
        ));
    }

    let mut reordered_fields = Vec::with_capacity(def.fields.len());
    for &idx in &new_order {
        if idx >= def.fields.len() {
            return Err(JsValue::from_str("Invalid index in new_order"));
        }
        reordered_fields.push(def.fields[idx].clone());
    }

    def.fields = reordered_fields;
    serde_wasm_bindgen::to_value(&def).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn parse_schema(text: &str) -> Result<JsValue, JsValue> {
    console_error_panic_hook::set_once();

    let mut structs = Vec::new();
    let mut current_struct: Option<StructDef> = None;

    // Very basic primitive parser for Cap'n Proto schemas
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with('@') {
            continue;
        }

        if line.starts_with("struct ") {
            if let Some(s) = current_struct.take() {
                structs.push(s);
            }
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let name = parts[1].trim_end_matches('{').to_string();
                current_struct = Some(StructDef {
                    name,
                    fields: Vec::new(),
                });
            }
        } else if line == "}" || line == "};" {
            if let Some(s) = current_struct.take() {
                structs.push(s);
            }
        } else if let Some(s) = &mut current_struct {
            // Probably a field: name @id :Type;
            if line.contains('@') && line.contains(':') {
                let parts: Vec<&str> = line.split('@').collect();
                if parts.len() >= 2 {
                    let name = parts[0].trim().to_string();
                    let rest: Vec<&str> = parts[1].split(':').collect();
                    if rest.len() >= 2 {
                        let id_str = rest[0].trim();
                        if let Ok(id) = id_str.parse::<u32>() {
                            let type_str = rest[1]
                                .split('=')
                                .next()
                                .unwrap_or("")
                                .trim()
                                .trim_end_matches(';')
                                .to_string();
                            s.fields.push(Field {
                                name,
                                id,
                                field_type: type_str,
                            });
                        }
                    }
                }
            }
        }
    }

    if let Some(s) = current_struct.take() {
        structs.push(s);
    }

    let schema = Schema { structs };
    serde_wasm_bindgen::to_value(&schema).map_err(|e| JsValue::from_str(&e.to_string()))
}
