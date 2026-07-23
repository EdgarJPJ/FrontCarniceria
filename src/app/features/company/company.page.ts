import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';

import { mensajeDeError } from '../../core/http/api-error';
import { Company, CompanyService } from './company.service';

/**
 * Los datos de la propia carnicería: es un formulario de un solo registro, no
 * una lista, así que no hay panel ni tabla — el contenido de la página es el
 * formulario.
 */
@Component({
  selector: 'app-company-page',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './company.page.html',
  styleUrl: './company.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyPage {
  private readonly fb = inject(FormBuilder);
  private readonly companies = inject(CompanyService);

  protected readonly empresa = signal<Company | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly guardando = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    rfc: ['', Validators.maxLength(20)],
    phone: ['', Validators.maxLength(20)],
    plan: ['basico', Validators.required],
  });

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.companies.obtener().subscribe({
      next: (c) => {
        this.empresa.set(c);
        this.form.reset({
          name: c.name,
          rfc: c.rfc ?? '',
          phone: c.phone ?? '',
          plan: c.plan.toLowerCase(),
        });
        this.cargando.set(false);
      },
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  protected guardar(): void {
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    this.error.set(null);
    this.aviso.set(null);

    this.companies.actualizar(this.form.getRawValue()).subscribe({
      next: (c) => {
        this.empresa.set(c);
        this.guardando.set(false);
        this.aviso.set('Guardado. El nombre en el riel se actualiza al volver a iniciar turno.');
      },
      error: (e: unknown) => {
        this.guardando.set(false);
        this.error.set(mensajeDeError(e));
      },
    });
  }
}
