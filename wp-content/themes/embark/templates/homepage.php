<?php
    /*
    	Template Name: Homepage
    *
    *   @package Crunch
    *   @since Crunch 2.0.0
    */
?>

<?php get_header(); ?>

<main id="main" class="homepage-template">

	<section class="intro element-paddings">
		<div class="container">
			<div class="row justify-content-between">
				<div class="col-md-6">
					<div class="intro__title-wrapper">
						<h1 class="intro__title"><?php the_title(); ?></h1><!-- /.intro__title -->
					</div><!-- /.intro__title-wrapper -->
					<div class="intro__content content element-small-margin-top">
						<?php the_content(); ?>
					</div><!-- /.intro__content content element-small-margin-top -->
				</div><!-- /.col-md-6 -->
				<div class="col-md-6 text-center">
					<a href="#" class="embark-button embark-button__full-background embark-button__full-background--secondary-color element-margin-top mt-md-0">See Embark in action</a>
					<div class="intro__video-wrapper element-small-margin-top">
						<div class="video-bar text-left"><span></span><span></span><span></span></div><!-- /.video-bar text-left -->
						<?php the_field('intro_video'); ?>
					</div><!-- /.intro__video-wrapper element-small-margin-top -->
				</div><!-- /.col-md-6 text-center -->
			</div><!-- /.row justify-content-between -->
		</div><!-- /.container -->
	</section><!-- /.intro element-paddings -->

	<section class="about-what element-padding-bottom">
		<div class="container">
			<div class="row">
				<div class="col-12 text-center">
					<h2 class="about-what__title"><?php the_field( 'what_title' ); ?></h2><!-- /.about-what__title -->
					<div class="about-what__content content element-small-margin-top">
						<?php the_field( 'what_content' ); ?>
					</div><!-- /.about-what__content content element-small-margin-top -->
				</div><!-- /.col-12 text-center -->
			</div><!-- /.row -->
		</div><!-- /.container -->
	</section><!-- /.about-what element-padding-bottom -->

	<section class="about-why element-paddings">
		<div class="container">
			<div class="row">
				<div class="col-12 text-center">
					<h2 class="about-why__title"><?php the_field( 'why_title' ); ?></h2><!-- /.about-why__title -->
					<div class="about-why__content content element-small-margin-top">
						<?php the_field( 'why_content' ); ?>
					</div><!-- /.about-why__content content element-small-margin-top -->
				</div><!-- /.col-12 text-center -->
			</div><!-- /.row -->
		</div><!-- /.container -->
	</section><!-- /.about-why element-paddings -->

	<section class="about-how element-padding-top">
		<div class="container">
			<div class="row">
				<div class="col-md-10 col-lg-9 mx-auto">
					<h2 class="about-how__title text-center"><?php the_field( 'how_title' ); ?></h2><!-- /.about-how__title text-center -->
					<div class="about-how__content content element-small-margin-top">
						<?php the_field( 'how_content' ); ?>
					</div><!-- /.about-how__content content element-small-margin-top -->
				</div><!-- /.col-md-10 col-lg-9 mx-auto -->
			</div><!-- /.row -->
		</div><!-- /.container -->
	</section><!-- /.about-how element-padding-top -->

	<section class="for-who element-paddings">
		<div class="container">
			<div class="row">
				<div class="col-md-6 text-auto">
					<div class="single-for text-center">
						<img src="<?php echo get_template_directory_uri(); ?>/images/icon__customers.svg" alt="icon" class="single-for__icon svg" />
						<h2 class="single-for__title element-extra-small-margin-top">Embark for your customers</h2><!-- /.single-for__title element-extra-small-margin-top -->
						<div class="single-for__content content element-small-margin-top">
							<p>Customers can provide you with information either online, via an interactive app or over the phone – whichever is easiest for them.</p>
						</div><!-- /.single-for__content content element-small-margin-top -->

						<div class="single-for__accordion accordion element-medium-margin-top" id="accordion-1">
							<div class="card">
								<div class="card-header" id="heading_one_1">
									<button class="card-header__button" type="button" data-toggle="collapse" data-target="#collapse_one_1" aria-expanded="true" aria-controls="collapse_one_1">Convenient and easy-to-use</button>
								</div><!-- /#heading_one_1.card-header -->
								<div id="collapse_one_1" class="collapse show" aria-labelledby="heading_one" data-parent="#accordion-1">
									<div class="card-body">
										<p>Embark is fully modular and customisable. This means you can utilise as many or as few of our services as you need to.</p>
									</div><!-- /.card-body -->
								</div><!-- /#collapse_one_1.collapse show -->
							</div><!-- /.card -->
							<div class="card">
								<div class="card-header" id="heading_one_2">
									<button class="card-header__button collapsed" type="button" data-toggle="collapse" data-target="#collapse_one_2" aria-expanded="false" aria-controls="collapse_one_2">Convenient and easy-to-use</button>
								</div><!-- /#heading_one_2.card-header -->
								<div id="collapse_one_2" class="collapse" aria-labelledby="heading_one" data-parent="#accordion-1">
									<div class="card-body">
										<p>Embark is fully modular and customisable. This means you can utilise as many or as few of our services as you need to.</p>
									</div><!-- /.card-body -->
								</div><!-- /#collapse_one_2.collapse -->
							</div><!-- /.card -->
							<div class="card">
								<div class="card-header" id="heading_one_3">
									<button class="card-header__button collapsed" type="button" data-toggle="collapse" data-target="#collapse_one_3" aria-expanded="false" aria-controls="collapse_one_3">Convenient and easy-to-use</button>
								</div><!-- /#heading_one_3.card-header -->
								<div id="collapse_one_3" class="collapse" aria-labelledby="heading_one" data-parent="#accordion-1">
									<div class="card-body">
										<p>Embark is fully modular and customisable. This means you can utilise as many or as few of our services as you need to.</p>
									</div><!-- /.card-body -->
								</div><!-- /#collapse_one_3.collapse -->
							</div><!-- /.card -->
						</div><!-- /#accordion-1.single-for__accordion accordion element-medium-margin-top -->
					</div><!-- /.single-for text-center -->
				</div><!-- /.col-md-6 text-auto -->
				<div class="col-md-6 text-auto">
					<div class="single-for text-center">
						<img src="" alt="" class="single-for__icon svg" />
						<h2 class="single-for__title element-extra-small-margin-top">Embark for your customers</h2><!-- /.single-for__title element-extra-small-margin-top -->
						<div class="single-for__content content element-small-margin-top">
							<p>Customers can provide you with information either online, via an interactive app or over the phone – whichever is easiest for them.</p>
						</div><!-- /.single-for__content content element-small-margin-top -->

						<div class="single-for__accordion accordion element-medium-margin-top" id="accordion-2">
							<div class="card">
								<div class="card-header" id="heading_two_1">
									<button class="card-header__button" type="button" data-toggle="collapse" data-target="#collapse_two_1" aria-expanded="true" aria-controls="collapse_two_1">Convenient and easy-to-use</button>
								</div><!-- /#heading_two_1.card-header -->
								<div id="collapse_two_1" class="collapse show" aria-labelledby="heading_two" data-parent="#accordion-2">
									<div class="card-body">
										<p>Embark is fully modular and customisable. This means you can utilise as many or as few of our services as you need to.</p>
									</div><!-- /.card-body -->
								</div><!-- /#collapse_two_1.collapse show -->
							</div><!-- /.card -->
							<div class="card">
								<div class="card-header" id="heading_two_2">
									<button class="card-header__button collapsed" type="button" data-toggle="collapse" data-target="#collapse_two_2" aria-expanded="false" aria-controls="collapse_two_2">Convenient and easy-to-use</button>
								</div><!-- /#heading_two_2.card-header -->
								<div id="collapse_two_2" class="collapse" aria-labelledby="heading_two" data-parent="#accordion-2">
									<div class="card-body">
										<p>Embark is fully modular and customisable. This means you can utilise as many or as few of our services as you need to.</p>
									</div><!-- /.card-body -->
								</div><!-- /#collapse_two_2.collapse -->
							</div><!-- /.card -->
							<div class="card">
								<div class="card-header" id="heading_two_3">
									<button class="card-header__button collapsed" type="button" data-toggle="collapse" data-target="#collapse_two_3" aria-expanded="false" aria-controls="collapse_two_3">Convenient and easy-to-use</button>
								</div><!-- /#heading_two_3.card-header -->
								<div id="collapse_two_3" class="collapse" aria-labelledby="heading_two" data-parent="#accordion-2">
									<div class="card-body">
										<p>Embark is fully modular and customisable. This means you can utilise as many or as few of our services as you need to.</p>
									</div><!-- /.card-body -->
								</div><!-- /#collapse_two_3.collapse -->
							</div><!-- /.card -->
						</div><!-- /#accordion-1.single-for__accordion accordion element-medium-margin-top -->
					</div><!-- /.single-for text-center -->
				</div><!-- /.col-md-6 text-auto -->
			</div><!-- /.row -->
		</div><!-- /.container -->
	</section><!-- /.for-who element-paddings -->

	<section class="key-facts element-paddings">
		<div class="container">
			<div class="row">
				<div class="col">
					<img src="" alt="" class="key-facts__icon" />
				</div><!-- /.col -->
				<div class="col">
					<h2 class="key-facts__title">Key facts</h2><!-- /.key-facts__title -->
				</div><!-- /.col -->
				<div class="col-12">
					<div class="key-facts__content content element-small-margin-top">
						<p>Having a system which lets your agents work with a customer is great. Having one that customers can use themselves too is even better</p>
					</div><!-- /.key-facts__content content element-small-margin-top -->
				</div><!-- /.col-12 -->
			</div><!-- /.row -->
			<div class="row">
				<div class="col-md-6">
					<img src="" alt="" class="key-facts__image" />

					<div class="impression element-margin-top d-none d-md-block">
						<h3 class="impression__title">Leave a lasting impression</h3><!-- /.impression__title -->
						<div class="impression__content content">
							<p>Embark will bring your customers on-board and facilitate a lasting relationship</p>
						</div><!-- /.impression__content content -->
					</div><!-- /.impression element-margin-top d-none d-md-block -->

				</div><!-- /.col-md-6 -->
				<div class="col-md-6">
					<div class="single-fact element-medium-margin-top">
						<div class="row">
							<div class="col col-auto">
								<img src="" alt="" class="single-fact__icon" />
							</div><!-- /.col col-auto -->
							<div class="col">
								<h3 class="single-fact__title">Accurate insight</h3><!-- /.single-fact__title -->
								<div class="single-fact__content content elelement-small-margin-top">
									<p>Real-time data reports and summaries for you and your customers</p>
								</div><!-- /.single-fact__content content elelement-small-margin-top -->
							</div><!-- /.col -->
						</div><!-- /.row -->
					</div><!-- /.single-fact element-medium-margin-top -->
					<div class="single-fact element-medium-margin-top">
						<div class="row">
							<div class="col col-auto">
								<img src="" alt="" class="single-fact__icon" />
							</div><!-- /.col col-auto -->
							<div class="col">
								<h3 class="single-fact__title">Accurate insight</h3><!-- /.single-fact__title -->
								<div class="single-fact__content content elelement-small-margin-top">
									<p>Real-time data reports and summaries for you and your customers</p>
								</div><!-- /.single-fact__content content elelement-small-margin-top -->
							</div><!-- /.col -->
						</div><!-- /.row -->
					</div><!-- /.single-fact element-medium-margin-top -->
					<div class="single-fact element-medium-margin-top">
						<div class="row">
							<div class="col col-auto">
								<img src="" alt="" class="single-fact__icon" />
							</div><!-- /.col col-auto -->
							<div class="col">
								<h3 class="single-fact__title">Accurate insight</h3><!-- /.single-fact__title -->
								<div class="single-fact__content content elelement-small-margin-top">
									<p>Real-time data reports and summaries for you and your customers</p>
								</div><!-- /.single-fact__content content elelement-small-margin-top -->
							</div><!-- /.col -->
						</div><!-- /.row -->
					</div><!-- /.single-fact element-medium-margin-top -->
					<div class="single-fact element-medium-margin-top">
						<div class="row">
							<div class="col col-auto">
								<img src="" alt="" class="single-fact__icon" />
							</div><!-- /.col col-auto -->
							<div class="col">
								<h3 class="single-fact__title">Accurate insight</h3><!-- /.single-fact__title -->
								<div class="single-fact__content content elelement-small-margin-top">
									<p>Real-time data reports and summaries for you and your customers</p>
								</div><!-- /.single-fact__content content elelement-small-margin-top -->
							</div><!-- /.col -->
						</div><!-- /.row -->
					</div><!-- /.single-fact element-medium-margin-top -->

					<div class="impression element-margin-top d-md-none">
						<h3 class="impression__title">Leave a lasting impression</h3><!-- /.impression__title -->
						<div class="impression__content content">
							<p>Embark will bring your customers on-board and facilitate a lasting relationship</p>
						</div><!-- /.impression__content content -->
					</div><!-- /.impression element-margin-top d-md-none -->

				</div><!-- /.col-md-6 -->
			</div><!-- /.row -->
		</div><!-- /.container -->
	</section><!-- /.key-facts element-paddings -->

</main><!-- /#main.homepage-template -->

<?php get_footer(); ?>