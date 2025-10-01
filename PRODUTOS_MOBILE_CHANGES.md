# Mudanças Necessárias para Responsividade Mobile - ProdutosPage.jsx

## 📋 RESUMO
A aba Produtos precisa de melhorias de responsividade para mobile. O arquivo atual tem **1732 linhas** e precisa de ajustes em 5 áreas principais.

---

## 🔧 MUDANÇAS NECESSÁRIAS

### 1. **Header Responsivo (Linhas 1477-1490)**

**SUBSTITUIR:**
```jsx
<motion.div variants={itemVariants} className="flex items-center justify-between mb-6">
    <div>
        <h1 className="text-3xl font-black text-text-primary tracking-tighter">Controle de Produtos</h1>
        <p className="text-text-secondary">Controle total sobre seu inventário e estoque.</p>
    </div>
    <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setShowStats(s => !s)} title={showStats ? 'Ocultar resumo' : 'Mostrar resumo'} aria-label={showStats ? 'Ocultar resumo' : 'Mostrar resumo'}>
          {showStats ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
        </Button>
        <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Exportar</Button>
        <Button variant="secondary" onClick={() => setIsXmlImportOpen(true)}><FileText className="mr-2 h-4 w-4" /> Importar XML</Button>
        <Button onClick={handleAddNew}><Plus className="mr-2 h-4 w-4" /> Novo Produto</Button>
    </div>
</motion.div>
```

**POR:**
```jsx
<motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
    <div className="flex-1 min-w-0">
        <h1 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tighter">Controle de Produtos</h1>
        <p className="text-sm text-text-secondary">Controle total sobre seu inventário e estoque.</p>
    </div>
    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
        <Button variant="outline" size="icon" onClick={() => setShowStats(s => !s)} title={showStats ? 'Ocultar resumo' : 'Mostrar resumo'} aria-label={showStats ? 'Ocultar resumo' : 'Mostrar resumo'} className="flex-shrink-0">
          {showStats ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
        </Button>
        <Button variant="outline" onClick={handleExport} className="text-sm"><Download className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Exportar</span></Button>
        <Button variant="secondary" onClick={() => setIsXmlImportOpen(true)} className="text-sm"><FileText className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Importar</span></Button>
        <Button onClick={handleAddNew} className="text-sm"><Plus className="mr-2 h-4 w-4" /> Novo</Button>
    </div>
</motion.div>
```

**MUDANÇAS:**
- ✅ Header flex-col em mobile, flex-row em desktop
- ✅ Título menor em mobile (text-2xl → text-3xl)
- ✅ Botões com wrap e full-width em mobile
- ✅ Texto dos botões oculto em mobile (só ícones)

---

### 2. **Filtros Responsivos (Linhas 1590-1604)**

**SUBSTITUIR:**
```jsx
<div className="p-4 flex flex-col sm:flex-row items-center justify-between border-b border-border gap-4">
    <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input placeholder="Buscar por nome ou código..." className="pl-9" value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} />
    </div>
     <div className="flex items-center gap-2 w-full sm:w-auto">
        <Filter size={16} className="text-text-muted"/>
        <Select value={filters.type} onValueChange={v => handleFilterChange('type', v)}><SelectTrigger className="w-[150px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todos Tipos</SelectItem><SelectItem value="Venda">Venda</SelectItem><SelectItem value="Uso Interno">Uso Interno</SelectItem></SelectContent></Select>
        <Select value={filters.category} onValueChange={v => handleFilterChange('category', v)}><SelectTrigger className="w-[150px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Categorias</SelectItem>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        <Select value={filters.status} onValueChange={v => handleFilterChange('status', v)}><SelectTrigger className="w-[150px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todos Status</SelectItem><SelectItem value="active">Ativo</SelectItem><SelectItem value="low_stock">Estoque Baixo</SelectItem><SelectItem value="inactive">Inativo</SelectItem></SelectContent></Select>
        <Button variant="outline" onClick={() => setIsCategoryModalOpen(true)}>
          <Tag className="h-4 w-4 mr-2"/> Categorias
        </Button>
    </div>
</div>
```

**POR:**
```jsx
<div className="p-4 flex flex-col gap-4 border-b border-border">
    <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input placeholder="Buscar por nome ou código..." className="pl-9" value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} />
    </div>
    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
        <div className="flex items-center gap-2 md:hidden">
          <Filter size={16} className="text-text-muted flex-shrink-0"/>
          <span className="text-sm text-text-muted">Filtros</span>
        </div>
        <Select value={filters.type} onValueChange={v => handleFilterChange('type', v)}><SelectTrigger className="w-full md:w-[150px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todos Tipos</SelectItem><SelectItem value="Venda">Venda</SelectItem><SelectItem value="Uso Interno">Uso Interno</SelectItem></SelectContent></Select>
        <Select value={filters.category} onValueChange={v => handleFilterChange('category', v)}><SelectTrigger className="w-full md:w-[150px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Categorias</SelectItem>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        <Select value={filters.status} onValueChange={v => handleFilterChange('status', v)}><SelectTrigger className="w-full md:w-[150px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todos Status</SelectItem><SelectItem value="active">Ativo</SelectItem><SelectItem value="low_stock">Estoque Baixo</SelectItem><SelectItem value="inactive">Inativo</SelectItem></SelectContent></Select>
        <Button variant="outline" onClick={() => setIsCategoryModalOpen(true)} className="w-full md:w-auto">
          <Tag className="h-4 w-4 mr-2"/> Categorias
        </Button>
    </div>
</div>
```

**MUDANÇAS:**
- ✅ Busca full-width
- ✅ Filtros empilhados verticalmente em mobile
- ✅ Selects full-width em mobile
- ✅ Label "Filtros" visível só em mobile

---

### 3. **Layout Dual - Cards Mobile + Tabela Desktop (Linhas 1606-1678)**

**ADICIONAR ANTES DA TABELA (linha 1612):**

```jsx
{/* Layout Mobile - Cards */}
<div className="md:hidden space-y-3 p-4">
  {sortedProducts.map((p) => (
    <div key={p.id} className="rounded-lg border border-border bg-surface p-4 space-y-3">
      {/* Header: Código + Status */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-sm text-text-muted">{p.code || '-'}</span>
        <span className={cn(
          "px-2 py-0.5 text-xs font-bold rounded-full flex-shrink-0",
          p.status === 'active' && 'bg-success/10 text-success',
          p.status === 'low_stock' && 'bg-warning/10 text-warning',
          p.status === 'inactive' && 'bg-danger/10 text-danger'
        )}>
          {p.status === 'active' ? 'Ativo' : p.status === 'low_stock' ? 'Estoque Baixo' : 'Inativo'}
        </span>
      </div>

      {/* Nome e Categoria */}
      <div>
        <h3 className="font-semibold text-base text-text-primary mb-1">{p.name}</h3>
        <p className="text-sm text-text-muted">{p.category}</p>
      </div>

      {/* Preço e Estoque */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="text-xs text-text-muted block mb-1">Preço</span>
          <span className="text-base font-bold text-text-primary">R$ {p.price.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-xs text-text-muted block mb-1">Estoque</span>
          <span className="text-base font-medium">{p.stock}</span>
        </div>
      </div>

      {/* Validade */}
      {p.validade && (
        <div>
          <span className="text-xs text-text-muted block mb-1">Validade</span>
          <span className="text-sm font-mono">
            {(() => {
              const d = p.validade instanceof Date ? p.validade : parseISO(String(p.validade));
              return isNaN(d) ? '-' : format(d, 'dd/MM/yy');
            })()}
          </span>
        </div>
      )}

      {/* Botões de Ação */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={() => handleEdit(p)} className="flex-1">
          <Edit size={14} className="mr-2" /> Editar
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleAskDelete(p)} className="text-danger hover:text-danger">
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  ))}
</div>

{/* Layout Desktop - Tabela */}
```

**E MODIFICAR A TABELA (linha 1613):**
```jsx
<div className="hidden md:block rounded-lg border border-border overflow-hidden">
```

**E MODIFICAR O GRID VIEW (linha 1667):**
```jsx
<div className="hidden md:grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
```

---

### 4. **Modal de Formulário - Tabs Responsivas (Linha 550)**

**SUBSTITUIR:**
```jsx
<TabsList className="grid grid-cols-5">
```

**POR:**
```jsx
<TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1">
```

---

### 5. **Modal de Formulário - Labels Responsivas (Linhas 561-667)**

Aplicar este padrão em TODOS os campos do formulário:

**DE:**
```jsx
<div className="grid grid-cols-4 items-center gap-4">
  <Label htmlFor="code" className="text-right">Código</Label>
  <Input id="code" className="col-span-3" />
</div>
```

**PARA:**
```jsx
<div className="grid grid-cols-1 md:grid-cols-4 items-start md:items-center gap-2 md:gap-4">
  <Label htmlFor="code" className="md:text-right">Código</Label>
  <Input id="code" className="md:col-span-3" />
</div>
```

**CAMPOS A MODIFICAR:**
- Código (linha 561)
- Descrição (linha 565)
- Categoria (linha 569)
- Unidade (linha 625)
- Tipo (linha 629)
- Ativo (linha 641)
- EAN-13 (linha 662)
- Validade (linha 666)
- Estoque (linha 694-695)
- Estoque Mín (linha 704)
- Preço de Custo (linha 759)
- Preço de Venda (linha 763)
- % de Lucro (linha 767)

---

## 📊 RESULTADO ESPERADO

### Mobile (< 768px)
- ✅ Header empilhado com botões só com ícones
- ✅ Filtros verticais full-width
- ✅ Cards de produtos otimizados
- ✅ Tabs do modal em 2 linhas
- ✅ Labels acima dos inputs

### Desktop (≥ 768px)
- ✅ Layout original preservado
- ✅ Tabela completa visível
- ✅ Todos os recursos funcionando

---

## 🎯 IMPLEMENTAÇÃO

**Opção 1:** Aplicar as mudanças manualmente no arquivo
**Opção 2:** Criar um novo arquivo com todas as correções
**Opção 3:** Usar find & replace no editor

**RECOMENDAÇÃO:** Aplicar mudança por mudança, testando após cada uma.
