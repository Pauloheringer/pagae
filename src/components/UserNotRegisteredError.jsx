import React from 'react';

const UserNotRegisteredError = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
      <div className="max-w-md w-full p-8 bg-card rounded-lg shadow-lg border border-border">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Acesso restrito</h1>
          <p className="text-muted-foreground mb-6">
            Seu usuário não está liberado para usar este app. Fale com o administrador.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
