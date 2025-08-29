import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";
import { Plus, GripVertical, Search, CheckCircle, Clock, FileText, ShoppingBag, Trash2, DollarSign, X, Store, Lock, Unlock, Minus, Banknote, ArrowDownCircle, ArrowUpCircle, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/components/ui/alert-dialog"
import { Label } from '@/components/ui/label';

// Mock Data
const initialTablesData = [
  { id: 'table-1', number: 1, status: 'available', order: [], customer: null },
  { id: 'table-2', number: 2, status: 'in-use', order: [{ id: 'prod-1', name: 'Coca-cola', price: 5, quantity: 2 }, { id: 'prod-2', name: 'Porção de Fritas', price: 25, quantity: 1 }], customer: "Equipe Rocket" },
  { id: 'table-3', number: 3, status: 'available', order: [], customer: null },
  { id: 'table-4', number: 4, status: 'awaiting-payment', order: [{ id: 'prod-3', name: 'Heineken 600ml', price: 15, quantity: 4 }], customer: "Os Vingadores" },
  { id: 'table-5', number: 5, status: 'available', order: [], customer: null },
  { id: 'table-6', number: 6, status: 'in-use', order: [{ id: 'prod-4', name: 'Água com gás', price: 4, quantity: 3 }], customer: "Liga da Justiça" },
  { id: 'table-7', number: 7, status: 'available', order: [], customer: null },
  { id: 'table-8', number: 8, status: 'available', order: [], customer: null },
];
const productsData = [
  { id: 'prod-1', name: 'Coca-cola', price: 5, category: 'Bebidas' },
  { id: 'prod-2', name: 'Porção de Fritas', price: 25, category: 'Comidas' },
  { id: 'prod-3', name: 'Heineken 600ml', price: 15, category: 'Bebidas' },
  { id: 'prod-4', name: 'Água com gás', price: 4, category: 'Bebidas' },
  { id: 'prod-5', name: 'Salgadinho', price: 8, category: 'Snacks' },
];

const statusConfig = {
  available: { label: 'Livre', color: 'border-success/50 bg-success/10 text-success', icon: CheckCircle },
  'in-use': { label: 'Em Uso', color: 'border-warning/50 bg-warning/10 text-warning', icon: Clock },
  'awaiting-payment': { label: 'Pagamento', color: 'border-info/50 bg-info/10 text-info', icon: FileText },
};

const pageVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

function VendasPage() {
  const { toast } = useToast();
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [isCashierOpen, setIsCashierOpen] = useState(false);
  const [isCounterModeOpen, setIsCounterModeOpen] = useState(false);
  const [counterOrder, setCounterOrder] = useState([]);
  const [isCashierDetailsOpen, setIsCashierDetailsOpen] = useState(false);

  useEffect(() => {
    setTables(initialTablesData);
    setSelectedTable(initialTablesData[1]);
  }, []);

  const handleNotImplemented = () => {
    toast({
      title: "Funcionalidade em desenvolvimento! 🚧",
      description: "Este recurso ainda não foi implementado, mas você pode solicitá-lo no próximo prompt! 🚀",
    });
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(tables);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setTables(items);
    toast({ title: "Layout das mesas atualizado!", description: "As posições foram salvas temporariamente." });
  };
  
  const calculateTotal = (order) => order.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const TableCard = ({ table, provided, isDragging }) => {
    const config = statusConfig[table.status];
    const Icon = config.icon;
    const total = calculateTotal(table.order);
    return (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        className={cn(
          "p-4 rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 relative h-32",
          config.color,
          isDragging ? 'shadow-2xl scale-105 bg-surface-2' : 'shadow-md',
          selectedTable?.id === table.id && 'ring-2 ring-brand scale-105 bg-surface-2'
        )}
        onClick={() => setSelectedTable(table)}
      >
        <div {...provided.dragHandleProps} className="absolute top-2 right-2 text-text-muted opacity-50 hover:opacity-100">
           <GripVertical size={16} />
        </div>
        <Icon className="w-8 h-8 mb-2" />
        <span className="text-xl font-bold text-text-primary">Mesa {table.number}</span>
        <span className="text-sm font-semibold h-5 mt-1 truncate max-w-full px-2">
          {table.status === 'in-use' || table.status === 'awaiting-payment' ? table.customer || `R$ ${total.toFixed(2)}` : config.label}
        </span>
      </div>
    )
  };

  const OrderPanel = ({ table }) => {
    if (!table) return (
      <div className="flex flex-col items-center justify-center h-full text-center text-text-muted">
        <ShoppingBag size={48} className="mb-4" />
        <h3 className="text-xl font-bold text-text-primary">Nenhuma mesa selecionada</h3>
        <p>Clique em uma mesa para ver os detalhes da comanda.</p>
      </div>
    );

    const total = calculateTotal(table.order);
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-text-primary">Comanda: Mesa {table.number}</h2>
          <p className={cn("text-sm font-semibold mt-1", statusConfig[table.status].color.replace('bg-', 'text-'))}>
            Status: {statusConfig[table.status].label}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {table.order.length === 0 ? (
            <div className="text-center text-text-muted pt-16">
              <p>Comanda vazia. Adicione produtos na aba ao lado.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {table.order.map(item => (
                <li key={item.id} className="flex items-center">
                  <div className="flex-1">
                    <p className="font-semibold text-text-primary">{item.name}</p>
                    <p className="text-sm text-text-muted">{item.quantity} x R$ {item.price.toFixed(2)}</p>
                  </div>
                  <p className="font-bold text-text-primary">R$ {(item.price * item.quantity).toFixed(2)}</p>
                  <Button variant="ghost" size="icon" className="ml-2 text-danger/70 hover:text-danger h-8 w-8" onClick={handleNotImplemented}><Trash2 size={16}/></Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-6 border-t border-border mt-auto">
          <div className="flex justify-between items-center text-xl font-bold mb-4">
            <span className="text-text-secondary">Total</span>
            <span className="text-text-primary">R$ {total.toFixed(2)}</span>
          </div>
          <Button size="lg" className="w-full" onClick={handleNotImplemented}><DollarSign className="mr-2" /> Fechar Conta</Button>
        </div>
      </div>
    );
  };

  const CashierDetailsDialog = () => (
    <Dialog open={isCashierDetailsOpen} onOpenChange={setIsCashierDetailsOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Detalhes do Caixa</DialogTitle>
          <DialogDescription>Resumo da sessão atual e atalhos rápidos.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="text-xs text-text-secondary">Saldo Inicial</p>
            <p className="text-2xl font-bold tabular-nums">R$ 0,00</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="text-xs text-text-secondary">Entradas</p>
            <p className="text-2xl font-bold text-success tabular-nums">R$ 0,00</p>
          </div>
          <div className="bg-surface-2 rounded-lg p-3 border border-border">
            <p className="text-xs text-text-secondary">Saídas</p>
            <p className="text-2xl font-bold text-danger tabular-nums">R$ 0,00</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="justify-start" onClick={() => toast({ title: 'Em desenvolvimento', description: 'Lançar suprimento' })}>
            <ArrowUpCircle className="h-4 w-4 mr-2 text-success" /> Suprimento
          </Button>
          <Button variant="outline" className="justify-start" onClick={() => toast({ title: 'Em desenvolvimento', description: 'Lançar sangria' })}>
            <ArrowDownCircle className="h-4 w-4 mr-2 text-danger" /> Sangria
          </Button>
          <Button variant="outline" className="justify-start col-span-2" onClick={() => toast({ title: 'Em desenvolvimento', description: 'Abrir fechamentos anteriores' })}>
            <CalendarDays className="h-4 w-4 mr-2" /> Fechamentos Anteriores
          </Button>
        </div>
        <div className="mt-2">
          <h4 className="text-sm font-bold mb-2">Movimentações do Dia</h4>
          <div className="text-sm text-text-secondary">Nenhuma movimentação registrada.</div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setIsCashierDetailsOpen(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const ProductsPanel = () => (
    <div className="flex flex-col h-full">
       <div className="p-4 border-b border-border">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input placeholder="Buscar produto..." className="pl-9" />
           </div>
       </div>
       <div className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
              {productsData.map(prod => (
                  <li key={prod.id} className="flex items-center p-2 rounded-md hover:bg-surface-2 transition-colors">
                      <div className="flex-1">
                          <p className="font-semibold">{prod.name}</p>
                          <p className="text-sm text-text-muted">R$ {prod.price.toFixed(2)}</p>
                      </div>
                      <Button size="sm" onClick={handleNotImplemented}><Plus size={16} className="mr-1"/> Adicionar</Button>
                  </li>
              ))}
          </ul>
       </div>
    </div>
  );

  const CounterModeModal = () => (
    <Dialog open={isCounterModeOpen} onOpenChange={setIsCounterModeOpen}>
        <DialogContent className="max-w-4xl h-[90vh]">
            <DialogHeader>
                <DialogTitle className="text-2xl font-bold">Modo Balcão</DialogTitle>
                <DialogDescription>Venda rápida para clientes sem mesa.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-6 h-full overflow-hidden pt-4">
                <div className="col-span-1 flex flex-col border-r border-border pr-6">
                    <h3 className="text-lg font-semibold mb-4">Catálogo de Produtos</h3>
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                        <Input placeholder="Buscar produto..." className="pl-9" />
                    </div>
                    <div className="flex-1 overflow-y-auto -mr-4 pr-4">
                        <ul className="space-y-2">
                        {productsData.map(prod => (
                            <li key={prod.id} className="flex items-center p-3 rounded-md bg-surface-2">
                                <div className="flex-1">
                                    <p className="font-semibold">{prod.name}</p>
                                    <p className="text-sm text-text-muted">R$ {prod.price.toFixed(2)}</p>
                                </div>
                                <Button size="sm" onClick={handleNotImplemented}><Plus size={16} className="mr-1"/> Adicionar</Button>
                            </li>
                        ))}
                        </ul>
                    </div>
                </div>
                <div className="col-span-1 flex flex-col">
                    <h3 className="text-lg font-semibold mb-4">Comanda do Balcão</h3>
                    <div className="flex-1 overflow-y-auto bg-surface-2 rounded-lg p-4">
                      {counterOrder.length === 0 ? <p className="text-center text-text-muted pt-16">Adicione produtos à comanda.</p> : <p>...</p>}
                    </div>
                     <div className="p-4 border-t border-border mt-auto">
                        <div className="flex justify-between items-center text-xl font-bold mb-4">
                            <span>Total</span>
                            <span>R$ {calculateTotal(counterOrder).toFixed(2)}</span>
                        </div>
                        <Button size="lg" className="w-full" onClick={handleNotImplemented}><DollarSign className="mr-2" /> Finalizar Pagamento</Button>
                    </div>
                </div>
            </div>
        </DialogContent>
    </Dialog>
  )

  const OpenCashierDialog = () => (
    <AlertDialog>
        <AlertDialogTrigger asChild>
            <Button variant="success" disabled={isCashierOpen}>
                <Unlock className="mr-2 h-4 w-4"/> Abrir Caixa
            </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Abrir Caixa</AlertDialogTitle>
                <AlertDialogDescription>Insira o valor inicial (suprimento) para abrir o caixa.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
                <Label htmlFor="initial-value">Valor Inicial</Label>
                <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">R$</span>
                    <Input id="initial-value" type="number" placeholder="0,00" className="pl-9 font-semibold"/>
                </div>
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => {setIsCashierOpen(true); toast({title: "Caixa aberto com sucesso!", variant: "success"})}}>Confirmar Abertura</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
  );

  const CloseCashierDialog = () => (
     <AlertDialog>
        <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={!isCashierOpen}>
                <Lock className="mr-2 h-4 w-4"/> Fechar Caixa
            </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Fechar Caixa</AlertDialogTitle>
                <AlertDialogDescription>Confira os valores e confirme o fechamento do caixa. Esta ação é irreversível.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4 space-y-2">
                <div className="flex justify-between"><span className="text-text-secondary">Valor Inicial:</span> <span className="font-mono">R$ 100,00</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Vendas (Dinheiro):</span> <span className="font-mono">R$ 540,50</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Vendas (Cartão):</span> <span className="font-mono">R$ 1230,00</span></div>
                <div className="flex justify-between font-bold text-lg"><span className="text-text-primary">Total em Caixa:</span> <span className="font-mono text-success">R$ 640,50</span></div>
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => {setIsCashierOpen(false); toast({title: "Caixa fechado!", description: "O relatório de fechamento foi gerado."})}}>Confirmar Fechamento</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <>
      <Helmet>
        <title>Loja - Fluxo7 Arena</title>
        <meta name="description" content="Loja (PDV): controle de mesas, produtos e vendas." />
      </Helmet>
      <motion.div variants={pageVariants} initial="hidden" animate="visible" className="h-full flex flex-col">
        <motion.div variants={itemVariants} className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black text-text-primary tracking-tighter">Loja</h1>
            <p className="text-text-secondary">Gerencie as vendas do seu bar ou lanchonete.</p>
          </div>
          <div className="flex items-center gap-2">
            <OpenCashierDialog />
            <CloseCashierDialog />
            <Button variant="outline" onClick={() => setIsCashierDetailsOpen(true)}>
              <Banknote className="mr-2 h-4 w-4" /> Detalhes do Caixa
            </Button>
            <div className="w-px h-6 bg-border mx-2"></div>
            <Button variant="outline" onClick={() => setIsCounterModeOpen(true)}><Store className="mr-2 h-4 w-4" /> Modo Balcão</Button>
            <Button onClick={handleNotImplemented}><Plus className="mr-2 h-4 w-4" /> Nova Mesa</Button>
          </div>
        </motion.div>
        
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-hidden">
            <motion.div variants={itemVariants} className="lg:col-span-2 bg-surface rounded-lg border border-border p-6 overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Mapa de Mesas</h2>
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="tables">
                        {(provided) => (
                             <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {tables.map((table, index) => (
                                    <Draggable key={table.id} draggableId={table.id} index={index}>
                                        {(provided, snapshot) => <TableCard table={table} provided={provided} isDragging={snapshot.isDragging} />}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            </motion.div>

            <motion.div variants={itemVariants} className="bg-surface rounded-lg border border-border flex flex-col">
                <Tabs defaultValue="order" className="flex flex-col h-full">
                    <TabsList className="grid w-full grid-cols-2 m-2">
                        <TabsTrigger value="order">Comanda</TabsTrigger>
                        <TabsTrigger value="products">Produtos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="order" className="flex-1 overflow-hidden"><OrderPanel table={selectedTable} /></TabsContent>
                    <TabsContent value="products" className="flex-1 overflow-hidden"><ProductsPanel/></TabsContent>
                </Tabs>
            </motion.div>
        </div>
      </motion.div>
      <CounterModeModal />
      <CashierDetailsDialog />
    </>
  );
}

export default VendasPage;