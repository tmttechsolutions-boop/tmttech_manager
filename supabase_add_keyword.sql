-- Rode este comando no SQL Editor para adicionar o suporte a "Palavras-Chave" na tabela existente.

ALTER TABLE automation_rules ADD COLUMN trigger_keyword text;

-- Atualizado com sucesso para suportar gatilhos como "Qualquer Mensagem" e "Palavra-chave Exata"
