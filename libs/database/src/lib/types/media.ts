// Map of API collection name to media definition
export type MediaCollection = Record<string, Media>;

// This will need to support the validation mechanism once media upload has been moved to v3.
export type Media = {
  // The name of the collection in the DB
  dbCollection: string;
  // Indicates if an entity is expecting to have more than one of this media type
  multiple: boolean;
};
