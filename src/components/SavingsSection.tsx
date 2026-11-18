import React, { useState } from 'react';
import { Plus, TrendingUp, Calendar, Trash2, Edit2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { SavingGoal, CashAccount } from '../types';

interface SavingsSectionProps {
  goals: SavingGoal[];
  accounts: CashAccount[];
  onDeposit: (goal: SavingGoal) => void;
  onWithdraw: (goal: SavingGoal) => void;
  onEdit: (goal: SavingGoal) => void;
  onDelete: (id: string) => void;
  onOpenCreateModal: () => void;
  onCreateRecurringInvestment?: (goal: SavingGoal) => void;
}

export const SavingsSection: React.FC<SavingsSectionProps> = ({
  goals,
  accounts,
  onDeposit,
  onWithdraw,
  onEdit,
  onDelete,
  onOpenCreateModal,
  onCreateRecurringInvestment,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">Reservas e Metas</h2>
        <button
          onClick={onOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Nova Reserva
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goals.map((goal) => {
          const hasTarget = Boolean(goal.hasTarget || (goal.target_amount && goal.target_amount > 0));
          const currentAmount = goal.current_amount || 0;
          const targetAmount = goal.target_amount || 0;
          const percentage = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;

          return (
            <div key={goal.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{goal.icon || '🎯'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded-md">
                          {goal.currency || 'BRL'}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${hasTarget ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600'}`}>
                          {hasTarget ? 'META DEFINIDA' : 'LIVRE'}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mt-0.5">{goal.name}</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEdit(goal)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(goal.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {goal.deadline && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-4">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{goal.deadline}</span>
                  </div>
                )}

                <div className="flex justify-between items-end my-3">
                  <div>
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Acumulado</span>
                    <div className="text-2xl font-black text-gray-900">
                      {goal.currency === 'USD' ? 'US$' : goal.currency === 'BRL' ? 'R$' : '$'} {currentAmount.toLocaleString()}
                    </div>
                  </div>
                  {hasTarget && (
                    <div className="text-right">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Meta</span>
                      <div className="text-lg font-bold text-gray-700">
                        {goal.currency === 'USD' ? 'US$' : goal.currency === 'BRL' ? 'R$' : '$'} {targetAmount.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>

                {hasTarget && (
                  <div className="mb-4">
                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-1 text-xs text-gray-500 font-medium">
                      <span>{percentage}% concluído</span>
                      <span>Falta {(targetAmount - currentAmount > 0 ? targetAmount - currentAmount : 0).toLocaleString()} {goal.currency || 'BRL'}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                <button
                  onClick={() => onDeposit(goal)}
                  className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-sm text-sm"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Aporte
                </button>
                <button
                  onClick={() => onWithdraw(goal)}
                  className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors text-sm"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  Resgate
                </button>
                {hasTarget && (
                  <button
                    onClick={() => {
                      if (onCreateRecurringInvestment) {
                        onCreateRecurringInvestment(goal);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm text-sm"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Investir mensalmente
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
