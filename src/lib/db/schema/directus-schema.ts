interface FieldDefinition {
  field: string;
  type: string;
  schema: {
    is_primary_key?: boolean;
    is_nullable?: boolean;
    default_value?: unknown;
    max_length?: number;
  };
  meta: {
    interface?: string;
    special?: string[];
    readonly?: boolean;
    hidden?: boolean;
    required?: boolean;
    note?: string;
    options?: Record<string, unknown>;
  };
}

interface CollectionDefinition {
  collection: string;
  meta: {
    icon?: string;
    note?: string;
    display_template?: string;
    singleton?: boolean;
    accountability?: string;
  };
  schema: {
    name?: string;
  };
  fields: FieldDefinition[];
}

export const collections: CollectionDefinition[] = [
  {
    collection: "workspaces",
    meta: {
      icon: "business",
      note: "Business workspaces",
    },
    schema: { name: "workspaces" },
    fields: [
      {
        field: "name",
        type: "string",
        schema: { is_nullable: false, max_length: 64 },
        meta: { interface: "input", required: true },
      },
      {
        field: "slug",
        type: "string",
        schema: { is_nullable: false, max_length: 64 },
        meta: { interface: "input", required: true },
      },
      {
        field: "description",
        type: "text",
        schema: { is_nullable: true },
        meta: { interface: "textarea" },
      },
      {
        field: "logo",
        type: "uuid",
        schema: { is_nullable: true },
        meta: { interface: "file-image", special: ["file"] },
      },
      {
        field: "website",
        type: "string",
        schema: { is_nullable: true, max_length: 256 },
        meta: { interface: "input" },
      },
      {
        field: "status",
        type: "string",
        schema: { is_nullable: false, default_value: "active" },
        meta: {
          interface: "select-dropdown",
          options: {
            choices: [
              { text: "Active", value: "active" },
              { text: "Suspended", value: "suspended" },
              { text: "Archived", value: "archived" },
            ],
          },
        },
      },
    ],
  },
  {
    collection: "memberships",
    meta: {
      icon: "group",
      note: "Workspace memberships linking users to workspaces",
    },
    schema: { name: "memberships" },
    fields: [
      {
        field: "workspace",
        type: "uuid",
        schema: { is_nullable: false },
        meta: { interface: "many-to-one", special: ["m2o"], required: true },
      },
      {
        field: "user",
        type: "string",
        schema: { is_nullable: false },
        meta: { interface: "input", note: "Directus user ID", required: true },
      },
      {
        field: "role",
        type: "string",
        schema: { is_nullable: false, default_value: "member" },
        meta: {
          interface: "select-dropdown",
          options: {
            choices: [
              { text: "Owner", value: "owner" },
              { text: "Admin", value: "admin" },
              { text: "Member", value: "member" },
            ],
          },
        },
      },
      {
        field: "status",
        type: "string",
        schema: { is_nullable: false, default_value: "active" },
        meta: {
          interface: "select-dropdown",
          options: {
            choices: [
              { text: "Active", value: "active" },
              { text: "Invited", value: "invited" },
              { text: "Inactive", value: "inactive" },
            ],
          },
        },
      },
    ],
  },
  {
    collection: "agents",
    meta: {
      icon: "smart_toy",
      note: "AI agents configured per workspace",
    },
    schema: { name: "agents" },
    fields: [
      {
        field: "workspace",
        type: "uuid",
        schema: { is_nullable: false },
        meta: { interface: "many-to-one", special: ["m2o"], required: true },
      },
      {
        field: "name",
        type: "string",
        schema: { is_nullable: false, max_length: 128 },
        meta: { interface: "input", required: true },
      },
      {
        field: "description",
        type: "text",
        schema: { is_nullable: true },
        meta: { interface: "textarea" },
      },
      {
        field: "avatar",
        type: "uuid",
        schema: { is_nullable: true },
        meta: { interface: "file-image", special: ["file"] },
      },
      {
        field: "system_prompt",
        type: "text",
        schema: { is_nullable: false },
        meta: { interface: "textarea", required: true },
      },
      {
        field: "tone",
        type: "string",
        schema: { is_nullable: false, default_value: "professional" },
        meta: {
          interface: "select-dropdown",
          options: {
            choices: [
              { text: "Professional", value: "professional" },
              { text: "Friendly", value: "friendly" },
              { text: "Casual", value: "casual" },
              { text: "Custom", value: "custom" },
            ],
          },
        },
      },
      {
        field: "language",
        type: "string",
        schema: { is_nullable: false, default_value: "en" },
        meta: { interface: "input" },
      },
      {
        field: "greeting",
        type: "text",
        schema: { is_nullable: false, default_value: "Hello! How can I help you today?" },
        meta: { interface: "textarea" },
      },
      {
        field: "fallback_message",
        type: "text",
        schema: { is_nullable: false },
        meta: { interface: "textarea" },
      },
      {
        field: "status",
        type: "string",
        schema: { is_nullable: false, default_value: "draft" },
        meta: {
          interface: "select-dropdown",
          options: {
            choices: [
              { text: "Draft", value: "draft" },
              { text: "Active", value: "active" },
              { text: "Paused", value: "paused" },
            ],
          },
        },
      },
    ],
  },
  {
    collection: "knowledge_sources",
    meta: {
      icon: "menu_book",
      note: "Knowledge sources for AI agents",
    },
    schema: { name: "knowledge_sources" },
    fields: [
      {
        field: "workspace",
        type: "uuid",
        schema: { is_nullable: false },
        meta: { interface: "many-to-one", special: ["m2o"], required: true },
      },
      {
        field: "agent",
        type: "uuid",
        schema: { is_nullable: true },
        meta: { interface: "many-to-one", special: ["m2o"] },
      },
      {
        field: "type",
        type: "string",
        schema: { is_nullable: false },
        meta: {
          interface: "select-dropdown",
          options: {
            choices: [
              { text: "Website", value: "website" },
              { text: "Document", value: "document" },
              { text: "FAQ", value: "faq" },
              { text: "Manual Text", value: "text" },
            ],
          },
          required: true,
        },
      },
      {
        field: "title",
        type: "string",
        schema: { is_nullable: false, max_length: 256 },
        meta: { interface: "input", required: true },
      },
      {
        field: "url",
        type: "string",
        schema: { is_nullable: true, max_length: 2048 },
        meta: { interface: "input" },
      },
      {
        field: "file",
        type: "uuid",
        schema: { is_nullable: true },
        meta: { interface: "file", special: ["file"] },
      },
      {
        field: "status",
        type: "string",
        schema: { is_nullable: false, default_value: "pending" },
        meta: {
          interface: "select-dropdown",
          options: {
            choices: [
              { text: "Pending", value: "pending" },
              { text: "Processing", value: "processing" },
              { text: "Ready", value: "ready" },
              { text: "Failed", value: "failed" },
            ],
          },
        },
      },
      {
        field: "error_message",
        type: "text",
        schema: { is_nullable: true },
        meta: { interface: "textarea", readonly: true },
      },
      {
        field: "chunk_count",
        type: "integer",
        schema: { is_nullable: false, default_value: 0 },
        meta: { interface: "input", readonly: true },
      },
    ],
  },
  {
    collection: "knowledge_chunks",
    meta: {
      icon: "view_module",
      note: "Chunked knowledge content with embeddings",
    },
    schema: { name: "knowledge_chunks" },
    fields: [
      {
        field: "source",
        type: "uuid",
        schema: { is_nullable: false },
        meta: { interface: "many-to-one", special: ["m2o"], required: true },
      },
      {
        field: "content",
        type: "text",
        schema: { is_nullable: false },
        meta: { interface: "textarea", required: true },
      },
      {
        field: "embedding",
        type: "json",
        schema: { is_nullable: true },
        meta: { interface: "input-code", special: ["cast-json"], note: "Vector embedding for pgvector" },
      },
      {
        field: "metadata",
        type: "json",
        schema: { is_nullable: true, default_value: {} },
        meta: { interface: "input-code", special: ["cast-json"] },
      },
      {
        field: "index",
        type: "integer",
        schema: { is_nullable: false, default_value: 0 },
        meta: { interface: "input" },
      },
    ],
  },
  {
    collection: "conversations",
    meta: {
      icon: "chat",
      note: "Customer conversations with AI agents",
    },
    schema: { name: "conversations" },
    fields: [
      {
        field: "workspace",
        type: "uuid",
        schema: { is_nullable: false },
        meta: { interface: "many-to-one", special: ["m2o"], required: true },
      },
      {
        field: "agent",
        type: "uuid",
        schema: { is_nullable: false },
        meta: { interface: "many-to-one", special: ["m2o"], required: true },
      },
      {
        field: "customer_email",
        type: "string",
        schema: { is_nullable: true, max_length: 256 },
        meta: { interface: "input" },
      },
      {
        field: "customer_name",
        type: "string",
        schema: { is_nullable: true, max_length: 128 },
        meta: { interface: "input" },
      },
      {
        field: "status",
        type: "string",
        schema: { is_nullable: false, default_value: "active" },
        meta: {
          interface: "select-dropdown",
          options: {
            choices: [
              { text: "Active", value: "active" },
              { text: "Resolved", value: "resolved" },
              { text: "Human Handoff", value: "handoff" },
            ],
          },
        },
      },
    ],
  },
  {
    collection: "messages",
    meta: {
      icon: "chat_bubble_outline",
      note: "Individual messages within conversations",
    },
    schema: { name: "messages" },
    fields: [
      {
        field: "conversation",
        type: "uuid",
        schema: { is_nullable: false },
        meta: { interface: "many-to-one", special: ["m2o"], required: true },
      },
      {
        field: "role",
        type: "string",
        schema: { is_nullable: false },
        meta: {
          interface: "select-dropdown",
          options: {
            choices: [
              { text: "User", value: "user" },
              { text: "Assistant", value: "assistant" },
              { text: "System", value: "system" },
            ],
          },
          required: true,
        },
      },
      {
        field: "content",
        type: "text",
        schema: { is_nullable: false },
        meta: { interface: "textarea", required: true },
      },
      {
        field: "sources",
        type: "json",
        schema: { is_nullable: true },
        meta: { interface: "input-code", special: ["cast-json"], note: "Source citations" },
      },
      {
        field: "metadata",
        type: "json",
        schema: { is_nullable: true, default_value: {} },
        meta: { interface: "input-code", special: ["cast-json"] },
      },
    ],
  },
];
